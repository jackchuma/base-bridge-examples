export default [
  {
    type: "constructor",
    inputs: [
      {
        name: "beacon",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "BEACON",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deploy",
    inputs: [
      {
        name: "remoteToken",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "name",
        type: "string",
        internalType: "string",
      },
      {
        name: "symbol",
        type: "string",
        internalType: "string",
      },
      {
        name: "decimals",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    outputs: [
      {
        name: "localToken",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isCrossChainErc20",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "isCrossChainErc20",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CrossChainERC20Created",
    inputs: [
      {
        name: "localToken",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "remoteToken",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "deployer",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;
