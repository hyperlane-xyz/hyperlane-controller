import { TestChainNames } from "@abacus-network/sdk";
import { ethers } from "ethers";

import { ControllerConfig, ControllerConfigMap } from "../../src/config";

export type ControllerChain = "test1";

const defaultControllerConfig: ControllerConfig = {
  recoveryManager: "0x4FbBB2b0820CF0cF027BbB58DC7F7f760BC0c57e",
  recoveryTimelock: 60 * 60 * 24 * 7,
  controller: ethers.constants.AddressZero,
};

export const controllerConfigMap: ControllerConfigMap<
  TestChainNames,
  ControllerChain
> = {
  test1: {
    ...defaultControllerConfig,
    controller: "0x4FbBB2b0820CF0cF027BbB58DC7F7f760BC0c57e",
  },
  test2: defaultControllerConfig,
  test3: defaultControllerConfig,
};
