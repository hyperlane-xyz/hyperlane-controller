import { AbacusRouterDeployer, RouterConfig } from "@abacus-network/deploy";
import { DeployerOptions } from "@abacus-network/deploy/dist/src/deploy";
import {
  ChainMap,
  ChainName,
  MultiProvider,
  objMap,
  promiseObjAll,
} from "@abacus-network/sdk";
import {
  ControllerConfig,
  ControllerContracts,
  controllerFactories,
  ControllerFactories,
} from "./config";

export class ControllerDeployer<
  Chain extends ChainName
> extends AbacusRouterDeployer<
  Chain,
  ControllerContracts,
  ControllerFactories,
  ControllerConfig
> {
  constructor(
    multiProvider: MultiProvider<Chain>,
    configMap: ChainMap<Chain, ControllerConfig & RouterConfig>,
    options?: DeployerOptions
  ) {
    super(multiProvider, configMap, controllerFactories, options);
  }

  async deployContracts(
    chain: Chain,
    config: ControllerConfig & RouterConfig
  ): Promise<ControllerContracts> {
    const dc = this.multiProvider.getChainConnection(chain);

    const upgradeBeaconController = await this.deployContract(
      chain,
      "upgradeBeaconController",
      []
    );

    const router = await this.deployProxiedContract(
      chain,
      "router",
      [config.recoveryTimelock],
      upgradeBeaconController.address,
      [config.abacusConnectionManager]
    );

    await upgradeBeaconController.transferOwnership(
      router.address,
      dc.overrides
    );

    return {
      router: router.contract,
      upgradeBeaconController: upgradeBeaconController,
    };
  }

  async deploy() {
    const contractsMap = await super.deploy();

    // Transfer ownership of routers to controller and recovery manager.
    await promiseObjAll(
      objMap(contractsMap, async (local, contracts) => {
        const config = this.configMap[local];
        await contracts.router.transferOwnership(config.recoveryManager);
        await contracts.router.setController(config.owner);
      })
    );

    return contractsMap;
  }
}
