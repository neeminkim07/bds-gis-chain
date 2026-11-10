require('@nomicfoundation/hardhat-toolbox');

// Mạng local: "npx hardhat node" mở nút blockchain tại http://127.0.0.1:8545 với 20 tài khoản có sẵn ETH giả.
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.24',
  networks: {
    localhost: { url: 'http://127.0.0.1:8545' },
  },
};
