import { TestChainNames } from "@abacus-network/sdk";
import { ethers } from "ethers";

import { ControllerConfig, ControllerConfigMap } from "../../src/config";

export type ControllerChain = "test1";
export const controllerChain: ControllerChain = 'test1';

const defaultControllerConfig: ControllerConfig = {
  recoveryManager: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // hardhat signer 3
  recoveryTimelock: 60 * 60 * 24 * 7,
  controller: ethers.constants.AddressZero,
};

export const controllerConfigMap: ControllerConfigMap<
  TestChainNames,
  ControllerChain
> = {
  test1: {
    ...defaultControllerConfig,
    controller: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // hardhat signer 2
  },
  test2: defaultControllerConfig,
  test3: defaultControllerConfig,
};
