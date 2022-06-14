import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import {
  ChainMap,
  MultiProvider,
  objMap,
  TestChainNames,
} from "@abacus-network/sdk";
import { ControllerDeployer } from "./deploy";
import { ControllerConfig, ControllerContracts } from "./config";
import { hardhatMultiProvider } from "@abacus-network/hardhat";
import { ControllerApp } from "./app";
import { TestCoreDeploy } from "@abacus-network/hardhat/dist/src/TestCoreDeploy";
import { TestRecipient__factory } from "@abacus-network/core";
import { Signer } from "ethers";
import { addressToBytes32 } from "@abacus-network/utils/dist/src/utils";
import { expect } from "chai";
import { TestCoreApp } from "@abacus-network/hardhat/dist/src/TestCoreApp";

describe("ControllerApp", async () => {
  let multiProvider: MultiProvider<TestChainNames>;
  let deployer: ControllerDeployer<TestChainNames>;
  let controllerConfig: ChainMap<
    TestChainNames,
    ControllerConfig & { abacusConnectionManager: string }
  >;
  let contracts: ChainMap<TestChainNames, ControllerContracts>;
  let controllerSigner: Signer;
  let core: TestCoreApp

  before(async () => {
    const recoveryTimelock = 60 * 60 * 24 * 7;
    const [controller, recoveryManager] = await ethers.getSigners();
    controllerSigner = controller;
    multiProvider = hardhatMultiProvider(ethers.provider, controller);
    const coreDeployer = new TestCoreDeploy(multiProvider);
    core = await coreDeployer.deployCore();
    controllerConfig = core.extendWithConnectionManagers(
      objMap(core.contractsMap, (chain) => ({
        recoveryTimelock,
        recoveryManager: recoveryManager.address,
        owner:
          chain === "test1" ? controller.address : ethers.constants.AddressZero,
      }))
    );
    deployer = new ControllerDeployer(multiProvider, controllerConfig);
    contracts = await deployer.deploy();
  });

  describe("calls", () => {
    let app: ControllerApp<TestChainNames>;
    beforeEach(async () => {
      app = new ControllerApp(contracts, multiProvider);

      const recipientF = new TestRecipient__factory(controllerSigner);
      const recipient = await recipientF.deploy();

      const functionCall = await recipient.populateTransaction.handle(0, addressToBytes32(recipient.address), "0x")
      app.pushCall("test2", {
        to: addressToBytes32(recipient.address),
        data: functionCall.data!,
      });
    });

    it("can build calls", async () => {
      const calls = await app.build();
      expect(calls).to.have.lengthOf(1);
    });

    it("can estimateGas", async () => {
      await app.estimateGas();
    });

    it("can execute", async () => {
      await app.execute();
      await core.processMessages()
    });
  });
});
