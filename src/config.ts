import { UpgradeBeaconController, UpgradeBeaconController__factory } from '@abacus-network/core';
import { BeaconProxyAddresses, ChainMap, Chains, ProxiedContract } from '@abacus-network/sdk';
import { types } from '@abacus-network/utils';
import { ethers } from 'hardhat';
import { ControllerRouter, ControllerRouter__factory } from './types';

export type ControllerConfigAddresses = {
  recoveryManager: types.Address;
  // Should be 0x0 on all non-controlling chains
  owner: types.Address;
};

export type ControllerConfig = 
  ControllerConfigAddresses & { recoveryTimelock: number };

export const controllerFactories = {
    router: new ControllerRouter__factory(),
    upgradeBeaconController: new UpgradeBeaconController__factory()
}

export type ControllerFactories = typeof controllerFactories

export type ControllerContracts = {
    router: ProxiedContract<ControllerRouter, BeaconProxyAddresses>,
    upgradeBeaconController: UpgradeBeaconController
}

export function validateControllerConfig<Chain extends Chains = Chains>(configs: ChainMap<Chains, ControllerConfig>) {
  const controllingEntry = Object.entries(configs).find(([chain, config]) => config.owner !== ethers.constants.AddressZero)

  if (!controllingEntry) {
    throw new Error("Config does not contain any controller")
  }

  const controllingChain = controllingEntry[0]

  for (const [chain, config] of Object.entries(configs)) {
    if (chain === controllingChain) continue;

    if (config.owner !== ethers.constants.AddressZero) {
      throw new Error(`Config contains controller ${config.owner} for chain ${chain}, but chain ${controllingChain} does as well`)
    }
  }
}