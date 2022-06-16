import { AbacusRouterDeployer, RouterConfig } from "@abacus-network/deploy";
import { DeployerOptions } from "@abacus-network/deploy/dist/src/deploy";
import {
  AbacusCore,
  ChainMap,
  ChainName,
  MultiProvider,
  objMap,
  promiseObjAll,
} from "@abacus-network/sdk";
import {
  ControllerConfig,
  ControllerConfigMap,
  ControllerContracts,
  controllerFactories,
  ControllerFactories,
} from "./config";
import { buildRouterConfigMap } from "./utils";

export class ControllerDeployer<
  Chain extends ChainName,
  ControllerChain extends Chain
> extends AbacusRouterDeployer<
  Chain,
  ControllerContracts,
  ControllerFactories,
  ControllerConfig<any>
> {
  constructor(
    multiProvider: MultiProvider<Chain>,
    configMap: ControllerConfigMap<Chain, ControllerChain>,
    core: AbacusCore<Chain>,
    options?: DeployerOptions
  ) {
    super(
      multiProvider,
      buildRouterConfigMap(configMap, core),
      controllerFactories,
      options
    );
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

  async setControllers(contractsMap: ChainMap<Chain, ControllerContracts>) {
    return promiseObjAll(
      objMap(contractsMap, async (local, contracts) =>
        contracts.router.setController(this.configMap[local].controller)
      )
    );
  }

  async deploy() {
    const contractsMap = await super.deploy();

    await this.setControllers(contractsMap);

    return contractsMap;
  }
}
