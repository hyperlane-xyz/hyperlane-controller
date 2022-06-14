import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import {
  AbacusCore,
  ChainMap,
  MultiProvider,
  objMap,
  TestChainNames,
} from "@abacus-network/sdk";
import { ControllerDeployer } from "./deploy";
import {
  ControllerConfig,
  ControllerContracts,
} from "./config";
import { hardhatMultiProvider } from "@abacus-network/hardhat";
import { ControllerApp } from "./app";
import { ControllerChecker } from "./check";

describe("controller", async () => {
  let multiProvider: MultiProvider<TestChainNames>;
  let deployer: ControllerDeployer<TestChainNames>;
  let controllerConfig: ChainMap<
    TestChainNames,
    ControllerConfig & { abacusConnectionManager: string }
  >;
  let contracts: ChainMap<TestChainNames, ControllerContracts>;

  before(async () => {
    const recoveryTimelock = 60 * 60 * 24 * 7;
    const [controller, recoveryManager] = await ethers.getSigners();
    multiProvider = hardhatMultiProvider(ethers.provider, controller);
    const core = AbacusCore.fromEnvironment("test", multiProvider);
    controllerConfig = core.extendWithConnectionManagers(
      objMap(core.contractsMap, (chain) => ({
        recoveryTimelock,
        recoveryManager: recoveryManager.address,
        owner:
          chain === "test1" ? controller.address : ethers.constants.AddressZero,
      }))
    );
    deployer = new ControllerDeployer(
      multiProvider,
      controllerConfig
    );
  });

  it("deploys", async () => {
    contracts = await deployer.deploy();
  });

  it("checks", async () => {
    const controller = new ControllerApp(contracts, multiProvider);
    const checker = new ControllerChecker(
      multiProvider,
      controller,
      controllerConfig
    );
    await checker.check();
  });
});
