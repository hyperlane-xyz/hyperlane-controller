import { UpgradeBeaconController, UpgradeBeaconController__factory } from '@abacus-network/core';
import { BeaconProxyAddresses, ProxiedContract } from '@abacus-network/sdk';
import { types } from '@abacus-network/utils';
import { ControllerRouter, ControllerRouter__factory } from './types';

export type ControllerConfigAddresses = {
  recoveryManager: types.Address;
  controller?: types.Address;
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