import { ethers } from "hardhat";

async function main() {
  console.log("Desplegando VotoUniversitario...");

  const VotoUniversitario = await ethers.getContractFactory("VotoUniversitario");
  const voto = await VotoUniversitario.deploy();

  await voto.waitForDeployment();

  console.log("VotoUniversitario desplegado en:", await voto.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});