import { ethers } from 'ethers';

import { RouterConfig } from '@abacus-network/deploy';
import {
  AbacusCore,
  ChainName,
  objMap,
  utils as sdkUtils,
} from '@abacus-network/sdk';
import { types, utils } from '@abacus-network/utils';

import { ControllerConfig, ControllerConfigMap } from './config';

export enum ControllerMessage {
  CALL = 1,
  SETCONTROLLER = 2,
  ENROLLREMOTEROUTER = 3,
  SETXAPPCONNECTIONMANAGER = 5,
}

export function formatSetController(address: types.Address): string {
  return ethers.utils.solidityPack(
    ['bytes1', 'bytes32'],
    [ControllerMessage.SETCONTROLLER, utils.addressToBytes32(address)],
  );
}

export function formatSetAbacusConnectionManager(
  address: types.Address,
): string {
  return ethers.utils.solidityPack(
    ['bytes1', 'bytes32'],
    [
      ControllerMessage.SETXAPPCONNECTIONMANAGER,
      utils.addressToBytes32(address),
    ],
  );
}

export function formatEnrollRemoteRouter(
  domain: types.Domain,
  address: types.Address,
): string {
  return ethers.utils.solidityPack(
    ['bytes1', 'uint32', 'bytes32'],
    [
      ControllerMessage.ENROLLREMOTEROUTER,
      domain,
      utils.addressToBytes32(address),
    ],
  );
}

export function formatCalls(callsData: types.CallData[]): string {
  let callBody = '0x';
  const numCalls = callsData.length;

  for (let i = 0; i < numCalls; i++) {
    const { to, data } = callsData[i];
    const dataLen = utils.getHexStringByteLength(data);

    if (!to || !data) {
      throw new Error(`Missing data in Call ${i + 1}: \n  ${callsData[i]}`);
    }

    let hexBytes = ethers.utils.solidityPack(
      ['bytes32', 'uint256', 'bytes'],
      [to, dataLen, data],
    );

    // remove 0x before appending
    callBody += hexBytes.slice(2);
  }

  return ethers.utils.solidityPack(
    ['bytes1', 'bytes1', 'bytes'],
    [ControllerMessage.CALL, numCalls, callBody],
  );
}

export function formatCall<
  C extends ethers.Contract,
  I extends Parameters<C['interface']['encodeFunctionData']>,
>(
  destinationContract: C,
  functionName: I[0],
  functionArgs: I[1],
): types.CallData {
  // Set up data for call message
  const callData = utils.formatCallData(
    destinationContract,
    functionName as any,
    functionArgs as any,
  );
  return {
    to: utils.addressToBytes32(destinationContract.address),
    data: callData,
  };
}

export const increaseTimestampBy = async (
  provider: ethers.providers.JsonRpcProvider,
  increaseTime: number,
) => {
  await provider.send('evm_increaseTime', [increaseTime]);
  await provider.send('evm_mine', []);
};

export interface Call {
  to: types.Address;
  data: ethers.utils.BytesLike;
}

// Returns the length (in bytes) of a BytesLike.
export function byteLength(bytesLike: ethers.utils.BytesLike): number {
  return ethers.utils.arrayify(bytesLike).length;
}

/**
 * Serialize a call to its packed ControllerMessage representation
 * @param call The function call to serialize
 * @returns The serialized function call, as a '0x'-prepended hex string
 */
export function serializeCall(call: Call): string {
  const { to, data } = call;
  const dataLen = byteLength(data);

  if (!to || !data) {
    throw new Error(`Missing data in Call: \n  ${call}`);
  }

  return ethers.utils.solidityPack(
    ['bytes32', 'uint32', 'bytes'],
    [to, dataLen, data],
  );
}

export function normalizeCall(partial: Partial<Call>): Readonly<Call> {
  const to = ethers.utils.hexlify(sdkUtils.canonizeId(partial.to!));
  const data = partial.data ?? '0x';

  return Object.freeze({
    to,
    data,
  });
}

export function buildRouterConfigMap<Chain extends ChainName>(
  controllerConfigMap: ControllerConfigMap<Chain, any>,
  core: AbacusCore<Chain>,
) {
  return objMap(
    controllerConfigMap,
    (chain, controllerConfig): RouterConfig & ControllerConfig<any> => ({
      ...controllerConfig,
      owner: controllerConfig.recoveryManager,
      abacusConnectionManager:
        core.getContracts(chain).abacusConnectionManager.address,
    }),
  );
}
