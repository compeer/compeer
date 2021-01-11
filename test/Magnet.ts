import {ethers, waffle} from 'hardhat';
import {assert, expect, use} from 'chai';
import {utils} from 'ethers';

const IERC20 = require('../build/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');
const zero_address = utils.getAddress('0x0000000000000000000000000000000000000000');
const {loadFixture, deployMockContract, solidity } = waffle;
use(solidity);

function getTimeInSeconds() {
  return Math.floor(new Date().getTime() / 1000)
}

/// @notice helper function to fast forward the EVM
function fastForwardEvmBy(seconds) {
  ethers.provider.send("evm_increaseTime", [seconds]);
  ethers.provider.send("evm_mine", []);
}

describe('Magnet', function() {

  async function fixtureBase() {
    const [owner, addr1] = await ethers.getSigners();
    const Magnet = await ethers.getContractFactory("Magnet");
    const magnet = await Magnet.deploy();
    await magnet.deployed();
    const mockERC20 = await deployMockContract(owner, IERC20.abi);
    return {magnet, mockERC20, owner, addr1};
  }

  async function fixtureRegisterFunder() {
    const [owner, addr1] = await ethers.getSigners();
    const Magnet = await ethers.getContractFactory("Magnet");
    const magnet = await Magnet.deploy();
    await magnet.deployed();
    const mockERC20 = await deployMockContract(owner, IERC20.abi);
    let admins = [addr1.address];
    let name = "Funder 1";
    let description = "Description 1";
    let imageUrl = "imageUrl 1";
    await magnet.registerFunder(admins, name, description, imageUrl);
    return {magnet, mockERC20, owner, addr1};
  }

  async function fixtureOneFunderAndMagnet() {
    const [owner, addr1] = await ethers.getSigners();
    const Magnet = await ethers.getContractFactory("Magnet");
    const magnet = await Magnet.deploy();
    await magnet.deployed();
    const mockERC20 = await deployMockContract(owner, IERC20.abi);
    
    let admins = [addr1.address];
    let name = "Funder 1";
    let description = "Description 1";
    let imageUrl = "imageUrl 1";
    await magnet.registerFunder(admins, name, description, imageUrl);

    let recipient = addr1.address;
    let token = mockERC20.address;
    let now = getTimeInSeconds();
    let startTime = now + 20;
    let vestingPeriodLength = 1;
    let amountPerPeriod = 1;
    let cliffTime = now + 40;
    let endTime = now + 60;
    let message = "Message 1";
    await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);

    return {magnet, mockERC20, owner, addr1};
  }

  /*
  // TODO: fix timing issues. Fails with 'start time is in the past'
  async function fixtureFundedMagnet() {
    const [owner, addr1] = await ethers.getSigners();
    const Magnet = await ethers.getContractFactory("Magnet");
    const magnet = await Magnet.deploy();
    await magnet.deployed();
    const mockERC20 = await deployMockContract(owner, IERC20.abi);
    
    let admins = [addr1.address];
    let name = "Funder 1";
    let description = "Description 1";
    let imageUrl = "imageUrl 1";
    await magnet.registerFunder(admins, name, description, imageUrl);

    let recipient = addr1.address;
    let token = mockERC20.address;
    let now = getTimeInSeconds();
    let startTime = now + 20;
    let vestingPeriodLength = 1;
    let amountPerPeriod = 1;
    let cliffTime = now + 40;
    let endTime = now + 60;
    let message = "Message 1";
    await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);

    let magnetId = 0;
    let amount = 1000;
    await magnet.deposit(magnetId, amount, mockERC20.address);

    return {magnet, mockERC20, owner, addr1};
  }
  */

  describe('Deploy', function() {
    it('Contracts should be defined', async function() {
      const {magnet, mockERC20, owner, addr1} = await waffle.loadFixture(fixtureBase);
      assert.isDefined(magnet);
      assert.isDefined(mockERC20);
    });

    it('State variables initialized to zero', async function() {
      const {magnet, mockERC20, owner, addr1} = await waffle.loadFixture(fixtureBase);
      expect(await magnet.nextVestingMagnetId()).to.equal(0);
      expect(await magnet.getFunderCount()).to.equal(0);
      expect(await magnet.isFunder(owner.address)).to.be.equal(false);
      expect(await magnet.getMagnetCount()).to.equal(0);
      expect(await magnet.isMagnet(0)).to.be.equal(false);
    });
  });

  describe('Funder', function() {
    it('Register funder with valid data', async function() {
      const {magnet, mockERC20, owner, addr1} = await waffle.loadFixture(fixtureBase);
      let admins = [addr1.address];
      let name = "Funder 1";
      let description = "Description 1";
      let imageUrl = "imageUrl 1";

      let expectedId = await magnet.getFunderCount();
      await expect(magnet.registerFunder(admins, name, description, imageUrl))
        .to.emit(magnet, 'FunderRegistered')
        .withArgs(owner.address, expectedId);

      let funder = await magnet.funders(owner.address);
      expect(funder.id).to.equal(0);
      expect(funder.name).to.equal(name);
      expect(funder.funder).to.equal(owner.address);
      expect(funder.description).to.equal(description);
      expect(await magnet.getFunderCount()).to.equal(1);
      expect(await magnet.isFunder(owner.address)).to.be.equal(true);
      expect(await magnet.getMagnetIdsByFunder(owner.address)).to.eql([]);
      expect(await magnet.getAdminsByFunder(owner.address)).to.eql(admins);
      expect(await magnet.isAdmin(addr1.address, owner.address)).to.be.equal(true);
    });

    it('Reverts if sender is already registered as a funder', async function() {
      const {magnet, mockERC20, owner, addr1} = await waffle.loadFixture(fixtureBase);
      let admins = [addr1.address];
      let name = "Funder 1";
      let description = "Description 1";
      let imageUrl = "imageUrl 1";

      await magnet.registerFunder(admins, name, description, imageUrl);
      await expect(magnet.registerFunder(admins, name, description, imageUrl))
        .to.be.revertedWith('Funder already exists');    
    });

    it('Is not funder', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureBase);
      expect(await magnet.isFunder(owner.address)).to.be.equal(false);
    });

    it('Reverts if funder does not exist', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureBase);
      await expect(magnet.getMagnetCountByFunder(owner.address))
        .to.be.revertedWith('Not a funder');
      await expect(magnet.getMagnetIdsByFunder(owner.address))
        .to.be.revertedWith('Not a funder');
      await expect(magnet.getAdminsByFunder(owner.address))
        .to.be.revertedWith('Not a funder');
    });

    // TODO: add test to prevent or require funder from being in admins array
  });

  describe('VestingMagnet', function() {
    it('Revert Mint if sender has not registered as funder', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureBase);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Must register as funder first');
    });

    it('Mint a VestingMagnet with valid data', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      let expectedId = await magnet.getMagnetCount();
      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.emit(magnet, 'VestingMagnetMinted')
        .withArgs(recipient, owner.address, expectedId);

      let m = await magnet.vestingMagnets(expectedId);
      expect(m.recipient).to.equal(recipient);
      expect(m.token).to.equal(token);
      expect(m.funder).to.equal(owner.address);
      expect(m.id).to.equal(expectedId);
      expect(m.startTime).to.equal(startTime);
      expect(m.vestingPeriodLength).to.equal(vestingPeriodLength);
      expect(m.amountPerPeriod).to.equal(amountPerPeriod);
      expect(m.cliffTime).to.equal(cliffTime);
      expect(m.endTime).to.equal(endTime);
      expect(m.message).to.equal(message);

      expect(await magnet.isMagnet(expectedId)).to.be.equal(true);
      expect(await magnet.getMagnetCount()).to.equal(1);
      expect(await magnet.getBalance(expectedId)).to.equal(0);
      expect(await magnet.getMagnetCountByFunder(owner.address)).to.be.equal(1);
      expect((await magnet.getMagnetIdsByFunder(owner.address))[0]).to.equal(0);
      expect((await magnet.getMagnetsByRecipient(recipient))[0])
        .to.equal(expectedId);
    });

    it('Is not magnet', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      expect(await magnet.isMagnet(0)).to.be.equal(false);
    });

    it('Reverts if magnet does not exist', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      await expect(magnet.getBalance(0))
        .to.be.revertedWith('Magnet does not exist');
    });

    it('Revert if recipient is zero address', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = zero_address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Recipient cant be the zero address');
    });

    it('Revert if startTime is in the past', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now - 10;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Start time is in the past');

      let zeroTime = 0;
      await expect(magnet.mintVestingMagnet(recipient, token, zeroTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Start time is in the past');
    });

    it('Revert if cliffTime is in the past', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now - 10;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Cliff time must be >= start time');

      let zeroTime = 0;
      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, zeroTime, endTime, message))
        .to.be.revertedWith('Cliff time must be >= start time');
    });

    it('Revert if endTime is in the past', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now - 10;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('End time must be > start time and cliff time');

      let zeroTime = 0;
      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, zeroTime, message))
        .to.be.revertedWith('End time must be > start time and cliff time');
    });

    it('Revert if vesting period is longer than duration', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 50;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Period must be < duration');
    });

    it('Revert if vesting period is zero', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 0;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Vesting period length cannot be zero');
    });

    it('Revert if duration is not a multiple of vesting period', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 7;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Duration must be a multiple of period length');
    });

    it('Revert if amount per period is zero', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 0;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";

      await expect(magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message))
        .to.be.revertedWith('Amount must be >0');
    });
  });

  describe('Deposit', function() {
    it('Deposit to a VestingMagnet with valid data', async function() {
      this.timeout(4000);
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureOneFunderAndMagnet);
      let expectedSender = owner.address;
      let expectedRecipient = magnet.address;
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 1000;
      let currentBalance = await magnet.getBalance(magnetId);
      let expectedBalance = currentBalance + amount;

      // initialize the mock contract to spoof return 'true' when transferFrom is called
      await mockERC20.mock.transferFrom.returns(true);
      await expect(magnet.deposit(magnetId, amount, mockERC20.address))
        .to.emit(magnet, 'Deposited')
        .withArgs(owner.address, magnetId, amount);
      
      // Waffle's calledOnContractWith is not currently supported by Hardhat. (1/5/2021)
      // expect("transferFrom").to.be.calledOnContractWith(mockERC20, [expectedSender, expectedRecipient, amount]);

      expect(await magnet.getBalance(magnetId)).to.equal(expectedBalance);
    });

    it('Should revert if depositing 0', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureOneFunderAndMagnet);
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 0;

      await mockERC20.mock.transferFrom.returns(true);
      await expect(magnet.deposit(magnetId, amount, mockERC20.address))
        .to.be.revertedWith('Deposit must be greater than zero');
    });

    it('Should revert if balance exceeds max uint', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureOneFunderAndMagnet);
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = ethers.constants.MaxUint256;

      await mockERC20.mock.transferFrom.returns(true);
      await expect(magnet.deposit(magnetId, amount, mockERC20.address))
        .to.emit(magnet, 'Deposited')
        .withArgs(owner.address, magnetId, amount);
      expect(await magnet.getBalance(magnetId)).to.equal(amount);
      await expect(magnet.deposit(magnetId, 1, mockERC20.address))
        .to.be.revertedWith('revert SafeMath: addition overflow');
    });

    it('Should revert if depositing a different token', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureOneFunderAndMagnet);
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 1000;
      let wrongToken = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await expect(magnet.deposit(magnetId, amount, wrongToken.address))
        .to.be.revertedWith('Deposit token address does not match magnet token');
    });

    it('Should revert if non-funder tries to deposit', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureOneFunderAndMagnet);
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 1000;

      await mockERC20.mock.transferFrom.returns(true);
      await expect(magnet.connect(addr1).deposit(magnetId, amount, mockERC20.address))
        .to.be.revertedWith('Only the funder can deposit to a magnet');
    });
  });

  describe('Get Balances', function() {

    /// @notice helper function to calculate the vested amount, ignoring cliff
    function estimateVestedAmountIgnoringCliff(testTime, startTime, vestingPeriodLength, amountPerPeriod) {
      if (testTime < startTime) return 0;
      return (testTime - startTime) / vestingPeriodLength * amountPerPeriod;
    }

    it('Should get correct amount ignoring cliff with valid input', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
      let magnetId = 0;

      let expectedAmountAtCliff = estimateVestedAmountIgnoringCliff(cliffTime, startTime, vestingPeriodLength, amountPerPeriod);
      let expectedAmountAtEnd = estimateVestedAmountIgnoringCliff(endTime, startTime, vestingPeriodLength, amountPerPeriod);

      let amountBeforeStart = await magnet.getVestedAmountIgnoringCliff(magnetId);
      expect(amountBeforeStart).to.equal(0);
      fastForwardEvmBy(25);

      let amountBeforeCliff = await magnet.getVestedAmountIgnoringCliff(magnetId);
      // console.log("amountBeforeCliff:", amountBeforeCliff.toString());
      // console.log("expectedAmountAtCliff", expectedAmountAtCliff);
      expect(amountBeforeCliff).to.be.above(0)
        .and.to.be.below(expectedAmountAtCliff);
      fastForwardEvmBy(25);

      let amountBeforeEnd = await magnet.getVestedAmountIgnoringCliff(magnetId);
      // console.log("amountBeforeEnd:", amountBeforeEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountBeforeEnd).to.be.above(0)
        .and.to.be.above(expectedAmountAtCliff)
        .and.to.be.below(expectedAmountAtEnd);
      fastForwardEvmBy(15);

      let amountAfterEnd = await magnet.getVestedAmountIgnoringCliff(magnetId);
      // console.log("amountAfterEnd:", amountAfterEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountAfterEnd). to.equal(expectedAmountAtEnd);
    });

    it('Should get correct vested amount with valid input', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
      let magnetId = 0;

      let expectedAmountAtCliff = estimateVestedAmountIgnoringCliff(cliffTime, startTime, vestingPeriodLength, amountPerPeriod);
      let expectedAmountAtEnd = estimateVestedAmountIgnoringCliff(endTime, startTime, vestingPeriodLength, amountPerPeriod);

      let amountBeforeStart = await magnet.getVestedAmount(magnetId);
      expect(amountBeforeStart).to.equal(0);
      fastForwardEvmBy(25);

      let amountBeforeCliff = await magnet.getVestedAmount(magnetId);
      expect(amountBeforeCliff).to.equal(0);
      fastForwardEvmBy(25);

      let amountBeforeEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountBeforeEnd:", amountBeforeEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountBeforeEnd).to.be.above(0)
        .and.to.be.above(expectedAmountAtCliff)
        .and.to.be.below(expectedAmountAtEnd);
      fastForwardEvmBy(15);

      let amountAfterEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountAfterEnd:", amountAfterEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountAfterEnd). to.equal(expectedAmountAtEnd);
    });

    it('Should get correct vested amount with cliff time equal to start time', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = startTime;
      let endTime = now + 60;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
      let magnetId = 0;

      let expectedAmountAtCliff = estimateVestedAmountIgnoringCliff(cliffTime, startTime, vestingPeriodLength, amountPerPeriod);
      let expectedAmountAtEnd = estimateVestedAmountIgnoringCliff(endTime, startTime, vestingPeriodLength, amountPerPeriod);

      let amountBeforeStart = await magnet.getVestedAmount(magnetId);
      expect(amountBeforeStart).to.equal(0);
      fastForwardEvmBy(25);

      let amountBeforeEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountBeforeEnd:", amountBeforeEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountBeforeEnd).to.be.above(0)
        .and.to.be.above(expectedAmountAtCliff)
        .and.to.be.below(expectedAmountAtEnd);
      fastForwardEvmBy(50);

      let amountAfterEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountAfterEnd:", amountAfterEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountAfterEnd). to.equal(expectedAmountAtEnd);
    });

    it('Should get correct vested amount with cliff time equal to end time', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);
      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let endTime = now + 60;
      let cliffTime = endTime;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
      let magnetId = 0;

      let expectedAmountAtCliff = estimateVestedAmountIgnoringCliff(cliffTime, startTime, vestingPeriodLength, amountPerPeriod);
      let expectedAmountAtEnd = estimateVestedAmountIgnoringCliff(endTime, startTime, vestingPeriodLength, amountPerPeriod);
      expect(expectedAmountAtCliff).to.equal(expectedAmountAtEnd);

      let amountBeforeStart = await magnet.getVestedAmount(magnetId);
      expect(amountBeforeStart).to.equal(0);
      fastForwardEvmBy(50);

      let amountBeforeEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountBeforeEnd:", amountBeforeEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountBeforeEnd).to.equal(0);
      fastForwardEvmBy(15);

      let amountAfterEnd = await magnet.getVestedAmount(magnetId);
      // console.log("amountAfterEnd:", amountAfterEnd.toString());
      // console.log("expectedAmountAtEnd", expectedAmountAtEnd);
      expect(amountAfterEnd).to.equal(expectedAmountAtEnd);
    });

    // TODO: add more tests for withdrawal
    // amountOwed > balance
    // amountOwed == balance
    // amountOwed < balance

    // TODO: add tests for getVestedAmountOwed after implementing
    //       Withdrawal and updating amountWithdrawn variable.
  });

  describe('Withdraw', function() {
    it('Withdraw as funder from a VestingMagnet before start time', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);

      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
  
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 1000;
      await mockERC20.mock.transferFrom.returns(true);
      await magnet.deposit(magnetId, amount, mockERC20.address);
  
      let amountToWithdraw = 800;
      await mockERC20.mock.transfer.returns(true);
      await expect(magnet.withdraw(magnetId, amountToWithdraw))
        .to.emit(magnet, 'Withdrawn')
        .withArgs(owner.address, magnetId, mockERC20.address, amountToWithdraw);
      
      expect(await magnet.getBalance(magnetId)).to.equal(amount - amountToWithdraw);
      // TODO: check amountwithdrawn
      // TODO: withdraw before cliff, before end, after end
    });

    it('Withdraw as recipient from a VestingMagnet before cliff time', async function() {
      const {magnet, mockERC20, owner, addr1} = await loadFixture(fixtureRegisterFunder);

      let recipient = addr1.address;
      let token = mockERC20.address;
      let now = getTimeInSeconds();
      let startTime = now + 20;
      let vestingPeriodLength = 1;
      let amountPerPeriod = 1;
      let cliffTime = now + 40;
      let endTime = now + 60;
      let message = "Message 1";
      await magnet.mintVestingMagnet(recipient, token, startTime, vestingPeriodLength, amountPerPeriod, cliffTime, endTime, message);
  
      let magnetId = await magnet.nextVestingMagnetId() - 1;
      let amount = 40;
      await mockERC20.mock.transferFrom.returns(true);
      await magnet.deposit(magnetId, amount, mockERC20.address);
  
      let amountToWithdraw = 10;
      await mockERC20.mock.transfer.returns(true);

      // attempt withdraw before startTime
      await expect(magnet.connect(addr1).withdraw(magnetId, amountToWithdraw))
        .to.be.revertedWith('Available balance is zero');

      fastForwardEvmBy(25);

      // attempt withdraw before cliffTime
      await expect(magnet.connect(addr1).withdraw(magnetId, amountToWithdraw))
        .to.be.revertedWith('Available balance is zero');

      fastForwardEvmBy(25);
      // attempt withdraw after cliffTime, before endTime
      await expect(magnet.connect(addr1).withdraw(magnetId, amountToWithdraw))
        .to.emit(magnet, 'Withdrawn');
      expect(await magnet.getBalance(magnetId))
        .to.be.at.least(amount - amountToWithdraw)
        .and.to.be.below(amount);
      // TODO: check amountwithdrawn
      // TODO: for recipient, also test before start, before cliff, before end, after end
    });

    // TODO: more withdraw tests
    // - withdraw as neither funder not recipient

    // TODO: if VestingMagnet is finite, prevent funder from depositing more than cumulative amount.

  // describe('Admin', function() {
  //   // TODO: test isAdmins mapping, adminFunder array, helper function
  // });
  });
});