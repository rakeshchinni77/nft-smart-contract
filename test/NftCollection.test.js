const { expect } = require("chai");

describe("NftCollection", function () {
  let nftCollection;
  let owner;
  let user1;
  let user2;
  let baseURI = "https://metadata.example.com/";
  let maxSupply = 100;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const NftCollection = await ethers.getContractFactory("NftCollection");
    nftCollection = await NftCollection.deploy("MyNFT", "MNFT", maxSupply, baseURI);
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await nftCollection.name()).to.equal("MyNFT");
      expect(await nftCollection.symbol()).to.equal("MNFT");
      expect(await nftCollection.maxSupply()).to.equal(maxSupply);
      expect(await nftCollection.baseURI()).to.equal(baseURI);
      expect(await nftCollection.totalSupply()).to.equal(0);
      expect(await nftCollection.owner()).to.equal(owner.address);
      expect(await nftCollection.mintingPaused()).to.be.false;
    });
  });

  describe("Minting", function () {
    it("Should mint a new NFT", async function () {
      await nftCollection.mint(user1.address, 1);
      expect(await nftCollection.balanceOf(user1.address)).to.equal(1);
      expect(await nftCollection.ownerOf(1)).to.equal(user1.address);
      expect(await nftCollection.totalSupply()).to.equal(1);
    });

    it("Should emit Transfer event on mint", async function () {
      await expect(nftCollection.mint(user1.address, 1))
        .to.emit(nftCollection, "Transfer")
        .withArgs(ethers.constants.AddressZero, user1.address, 1);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        nftCollection.connect(user1).mint(user1.address, 1)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should not mint to zero address", async function () {
      await expect(
        nftCollection.mint(ethers.constants.AddressZero, 1)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should not mint duplicate tokenId", async function () {
      await nftCollection.mint(user1.address, 1);
      await expect(
        nftCollection.mint(user2.address, 1)
      ).to.be.revertedWith("Token already exists");
    });

    it("Should not mint beyond max supply", async function () {
      for (let i = 1; i <= maxSupply; i++) {
        await nftCollection.mint(user1.address, i);
      }
      await expect(
        nftCollection.mint(user1.address, maxSupply + 1)
      ).to.be.revertedWith("Max supply reached");
    });

    it("Should not mint when minting is paused", async function () {
      await nftCollection.pauseMinting();
      await expect(
        nftCollection.mint(user1.address, 1)
      ).to.be.revertedWith("Minting is currently paused");
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await nftCollection.mint(user1.address, 1);
    });

    it("Should transfer NFT from owner", async function () {
      await nftCollection.connect(user1).transferFrom(user1.address, user2.address, 1);
      expect(await nftCollection.ownerOf(1)).to.equal(user2.address);
      expect(await nftCollection.balanceOf(user1.address)).to.equal(0);
      expect(await nftCollection.balanceOf(user2.address)).to.equal(1);
    });

    it("Should emit Transfer event", async function () {
      await expect(
        nftCollection.connect(user1).transferFrom(user1.address, user2.address, 1)
      )
        .to.emit(nftCollection, "Transfer")
        .withArgs(user1.address, user2.address, 1);
    });

    it("Should not transfer to zero address", async function () {
      await expect(
        nftCollection.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, 1)
      ).to.be.revertedWith("Cannot transfer to zero address");
    });

    it("Should not transfer non-existent token", async function () {
      await expect(
        nftCollection.connect(user1).transferFrom(user1.address, user2.address, 999)
      ).to.be.revertedWith("Not the owner");
    });

    it("Should not transfer if not owner or approved", async function () {
      await expect(
        nftCollection.connect(user2).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should transfer after approval", async function () {
      await nftCollection.connect(user1).approve(user2.address, 1);
      await nftCollection.connect(user2).transferFrom(user1.address, user2.address, 1);
      expect(await nftCollection.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Approvals", function () {
    beforeEach(async function () {
      await nftCollection.mint(user1.address, 1);
    });

    it("Should approve address for token transfer", async function () {
      await nftCollection.connect(user1).approve(user2.address, 1);
      expect(await nftCollection.getApproved(1)).to.equal(user2.address);
    });

    it("Should emit Approval event", async function () {
      await expect(
        nftCollection.connect(user1).approve(user2.address, 1)
      )
        .to.emit(nftCollection, "Approval")
        .withArgs(user1.address, user2.address, 1);
    });

    it("Should clear approval on transfer", async function () {
      await nftCollection.connect(user1).approve(user2.address, 1);
      await nftCollection.connect(user2).transferFrom(user1.address, user2.address, 1);
      expect(await nftCollection.getApproved(1)).to.equal(ethers.constants.AddressZero);
    });

    it("Should set approval for all tokens", async function () {
      await nftCollection.connect(user1).setApprovalForAll(user2.address, true);
      expect(await nftCollection.isApprovedForAll(user1.address, user2.address)).to.be.true;
    });

    it("Should emit ApprovalForAll event", async function () {
      await expect(
        nftCollection.connect(user1).setApprovalForAll(user2.address, true)
      )
        .to.emit(nftCollection, "ApprovalForAll")
        .withArgs(user1.address, user2.address, true);
    });

    it("Should revoke approval for all tokens", async function () {
      await nftCollection.connect(user1).setApprovalForAll(user2.address, true);
      await nftCollection.connect(user1).setApprovalForAll(user2.address, false);
      expect(await nftCollection.isApprovedForAll(user1.address, user2.address)).to.be.false;
    });

    it("Should not approve yourself", async function () {
      await expect(
        nftCollection.connect(user1).setApprovalForAll(user1.address, true)
      ).to.be.revertedWith("Cannot approve yourself");
    });

    it("Should allow operator to transfer", async function () {
      await nftCollection.connect(user1).setApprovalForAll(user2.address, true);
      await nftCollection.connect(user2).transferFrom(user1.address, user2.address, 1);
      expect(await nftCollection.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Token URI", function () {
    it("Should return correct tokenURI", async function () {
      await nftCollection.mint(user1.address, 1);
      expect(await nftCollection.tokenURI(1)).to.equal(baseURI + "1");
    });

    it("Should revert for non-existent token", async function () {
      await expect(
        nftCollection.tokenURI(999)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Minting Control", function () {
    it("Should pause minting", async function () {
      await nftCollection.pauseMinting();
      expect(await nftCollection.mintingPaused()).to.be.true;
    });

    it("Should unpause minting", async function () {
      await nftCollection.pauseMinting();
      await nftCollection.unpauseMinting();
      expect(await nftCollection.mintingPaused()).to.be.false;
    });

    it("Should emit MintingPaused event", async function () {
      await expect(nftCollection.pauseMinting())
        .to.emit(nftCollection, "MintingPaused")
        .withArgs(true);
    });

    it("Only owner can pause/unpause", async function () {
      await expect(
        nftCollection.connect(user1).pauseMinting()
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Balance and Supply", function () {
    it("Should correctly track balances", async function () {
      await nftCollection.mint(user1.address, 1);
      await nftCollection.mint(user1.address, 2);
      await nftCollection.mint(user2.address, 3);
      expect(await nftCollection.balanceOf(user1.address)).to.equal(2);
      expect(await nftCollection.balanceOf(user2.address)).to.equal(1);
      expect(await nftCollection.totalSupply()).to.equal(3);
    });

    it("Should update balances on transfer", async function () {
      await nftCollection.mint(user1.address, 1);
      await nftCollection.connect(user1).transferFrom(user1.address, user2.address, 1);
      expect(await nftCollection.balanceOf(user1.address)).to.equal(0);
      expect(await nftCollection.balanceOf(user2.address)).to.equal(1);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await nftCollection.mint(user1.address, 1);
    });

    it("Should burn a token", async function () {
      await nftCollection.connect(user1).burn(1);
      expect(await nftCollection.totalSupply()).to.equal(0);
      expect(await nftCollection.balanceOf(user1.address)).to.equal(0);
    });

    it("Should emit Transfer event on burn", async function () {
      await expect(
        nftCollection.connect(user1).burn(1)
      )
        .to.emit(nftCollection, "Transfer")
        .withArgs(user1.address, ethers.constants.AddressZero, 1);
    });

    it("Only owner can burn their token", async function () {
      await expect(
        nftCollection.connect(user2).burn(1)
      ).to.be.revertedWith("Only owner can burn");
    });

    it("Cannot burn non-existent token", async function () {
      await expect(
        nftCollection.connect(user1).burn(999)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Gas Efficiency", function () {
    it("Mint operation should be within reasonable gas", async function () {
      const tx = await nftCollection.mint(user1.address, 1);
      const receipt = await tx.wait();
      // Typical mint should use less than 80k gas
      expect(receipt.gasUsed).to.be.lt(ethers.BigNumber.from("80000"));
    });

    it("Transfer operation should be within reasonable gas", async function () {
      await nftCollection.mint(user1.address, 1);
      const tx = await nftCollection.connect(user1).transferFrom(user1.address, user2.address, 1);
      const receipt = await tx.wait();
      // Typical transfer should use less than 80k gas
      expect(receipt.gasUsed).to.be.lt(ethers.BigNumber.from("80000"));
    });
  });
});
