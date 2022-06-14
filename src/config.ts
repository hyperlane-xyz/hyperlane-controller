import {
  UpgradeBeaconController,
  UpgradeBeaconController__factory,
} from "@abacus-network/core";
import {
  ChainMap,
  Chains,
  RouterContracts,
  RouterFactories,
} from "@abacus-network/sdk";
import { types } from "@abacus-network/utils";
import { ethers } from "hardhat";
import { ControllerRouter, ControllerRouter__factory } from "./types";

export type ControllerConfig = {
  recoveryManager: types.Address;
  // Should be 0x0 on all non-controlling chains
  owner: types.Address;
  recoveryTimelock: number;
};

export type ControllerFactories = RouterFactories<ControllerRouter> & {
  upgradeBeaconController: UpgradeBeaconController__factory;
};

export const controllerFactories: ControllerFactories = {
  router: new ControllerRouter__factory(),
  upgradeBeaconController: new UpgradeBeaconController__factory(),
};

export type ControllerContracts = RouterContracts<ControllerRouter> & {
  upgradeBeaconController: UpgradeBeaconController;
};

export function validateControllerConfig<Chain extends Chains = Chains>(
  configs: ChainMap<Chain, ControllerConfig>
) {
  const controllingEntry = Object.entries<ControllerConfig>(configs).find(
    ([_, config]) => config.owner !== ethers.constants.AddressZero
  );

  if (!controllingEntry) {
    throw new Error("Config does not contain any controller");
  }

  const controllingChain = controllingEntry[0];

  for (const [chain, config] of Object.entries<ControllerConfig>(configs)) {
    if (chain === controllingChain) continue;

    if (config.owner !== ethers.constants.AddressZero) {
      throw new Error(
        `Config contains controller ${config.owner} for chain ${chain}, but chain ${controllingChain} does as well`
      );
    }
  }
}
