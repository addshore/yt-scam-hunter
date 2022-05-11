var assert = require('assert');
var fetchMock = require('fetch-mock');
var sut = require('../src/crypto-eth');

describe('crypto-eth', function () {
  describe('infoLink', function () {
    it('shoudl return a correct link', function () {
      assert.equal(sut.infoLink("walletId"), "https://etherscan.io/address/walletId");
    });
  });
  describe('walletExists', function () {
    it('should return the ether value when wallet exists', async function () {
      // https://docs.etherscan.io/api-endpoints/accounts#get-ether-balance-for-a-single-address
      fetchMock.mock(
        'https://api.etherscan.io/api?module=account&action=balance&address=0x0&apikey=' + process.env.ETHERSCAN_KEY,
        {
          "status": "1",
          "message": "OK",
          "result": "40891000000000000000000"
        }
      );
      let result = await sut.walletExists("0x0");
      assert.equal(result, "40891");
      fetchMock.reset();
    });
    it('should return false when no result', async function () {
      // https://docs.etherscan.io/api-endpoints/accounts#get-ether-balance-for-a-single-address
      fetchMock.mock(
        'https://api.etherscan.io/api?module=account&action=balance&address=0x2&apikey=' + process.env.ETHERSCAN_KEY,
        {
          "error": "No such wallet",
        }
      );
      let result = await sut.walletExists("0x2");
      assert.equal(result, false);
      fetchMock.reset();
    });
  });
  describe('walletsBalance', function () {
    it('should return balances for each wallet', async function () {
      // https://docs.etherscan.io/api-endpoints/accounts#get-ether-balance-for-multiple-addresses
      fetchMock.mock(
        'https://api.etherscan.io/api?module=account&action=balancemulti&tag=latest&address=0x0,0x1&apikey=' + process.env.ETHERSCAN_KEY,
        {
          "status": "1",
          "message": "OK",
          "result": [
            {
              "account": "0x0",
              "balance": "40891000000000000000000"
            },
            {
              "account": "0x1",
              "balance": "40892000000000000000000"
            }
          ]
        }
      );
      let result = await sut.walletsBalance(["0x0", "0x1"]);
      assert.equal(result["0x0"], "40891");
      assert.equal(result["0x1"], "40892");
      fetchMock.reset();
    });
  });
});
