import { ethers } from 'ethers';

import {
  UpgradeBeaconController,
  UpgradeBeaconController__factory
} from '@abacus-network/core';
import {
  ChainName,
  RouterContracts,
  RouterFactories
} from '@abacus-network/sdk';
import { types } from '@abacus-network/utils';

import { ControllerRouter, ControllerRouter__factory } from '../types';

export type ControllerConfig<IsGovernor extends boolean = false> = {
  recoveryManager: types.Address;
  recoveryTimelock: number;
  controller: IsGovernor extends true
    ? types.Address
    : typeof ethers.constants.AddressZero;
};

export type ControllerConfigMap<
  Chain extends ChainName,
  ControllerChain extends Chain,
> = {
  [key in Chain]: key extends ControllerChain
    ? ControllerConfig<true>
    : ControllerConfig;
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

export function validateControllerConfig<
  Chain extends ChainName = ChainName,
  ControllerChain extends Chain = Chain,
>(configs: ControllerConfigMap<Chain, ControllerChain>) {
  const controllingEntry = Object.entries<ControllerConfig<any>>(configs).find(
    ([_, config]) => config.controller !== ethers.constants.AddressZero,
  );

  if (!controllingEntry) {
    throw new Error('Config does not contain any controller');
  }

  const controllingChain = controllingEntry[0];

  for (const [chain, config] of Object.entries<ControllerConfig<any>>(
    configs,
  )) {
    if (chain === controllingChain) continue;

    if (config.controller !== ethers.constants.AddressZero) {
      throw new Error(
        `Config contains controller ${config.controller} for chain ${chain}, but chain ${controllingChain} does as well`,
      );
    }
  }
}
