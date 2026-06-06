import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import contractABI from '../../assets/VotoUniversitario.json';

const CONTRACT_ADDRESS = '0x7E94C235B9E6f16A3A0b99724CE69Cfb3ef9786b';

export interface Candidato {
  id: number;
  nombre: string;
  votos: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlockchainService {
  private provider: any;
  private signer: any;
  private contract: any;

  async conectarMetaMask(): Promise<string> {
    const win = window as any;
    if (!win.ethereum) throw new Error('MetaMask no está instalado');

    this.provider = new ethers.BrowserProvider(win.ethereum);
    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, this.signer);

    return await this.signer.getAddress();
  }

  // HELPER: aplica timeout a cualquier promesa
  private conTimeout<T>(promise: Promise<T>, ms: number, mensaje: string = 'timeout'): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(mensaje)), ms))
    ]);
  }

  // HELPER: hace polling al contrato hasta que la función predicado devuelva true
  private async esperarCondicion(
    predicado: () => Promise<boolean>,
    timeoutMs: number = 60000
  ): Promise<void> {
    const inicio = Date.now();
    let intento = 0;
    while (Date.now() - inicio < timeoutMs) {
      intento++;
      try {
        console.log(`[Polling] Intento ${intento} consultando estado del contrato...`);
        const resultado = await this.conTimeout(predicado(), 3000, 'predicado timeout');
        if (resultado) {
          console.log(`[Polling] ✅ Condición cumplida en intento ${intento}`);
          return;
        }
      } catch (e) {
        console.warn(`[Polling] Intento ${intento} falló:`, e);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    console.warn('[Polling] ⏰ Timeout total alcanzado, continuando.');
  }

  // HELPER: envía una tx aplicando timeout, retorna sin esperar wait()
  private async enviarTx(operacion: () => Promise<any>): Promise<void> {
    console.log('[TX] Enviando transacción...');
    try {
      await this.conTimeout(operacion(), 30000, 'envío tx timeout');
      console.log('[TX] ✅ Transacción enviada (hash recibido)');
    } catch (e: any) {
      if (e?.message === 'envío tx timeout') {
        console.warn('[TX] ⏰ Timeout esperando confirmación de envío, continuando al polling');
        return;
      }
      throw e;
    }
  }

  async registrarCandidato(nombre: string): Promise<void> {
    if (nombre.length > 32) throw new Error('El nombre no puede superar los 32 caracteres');

    const nombreBytes32 = ethers.encodeBytes32String(nombre);
    const totalAntes = Number(await this.contract.totalCandidatos());

    await this.enviarTx(() => this.contract.registrarCandidato(nombreBytes32));
    await this.esperarCondicion(async () => {
      const ahora = Number(await this.contract.totalCandidatos());
      return ahora > totalAntes;
    });
  }

  async registrarVotante(direccion: string): Promise<void> {
    if (!ethers.isAddress(direccion)) {
      throw new Error('La dirección proporcionada no es válida');
    }

    await this.enviarTx(() => this.contract.registrarVotante(direccion));
    await this.esperarCondicion(async () => {
      return await this.contract.esVotanteAutorizado(direccion);
    });
  }

  async abrirEleccion(): Promise<void> {
    await this.enviarTx(() => this.contract.abrirEleccion());
    await this.esperarCondicion(async () => {
      return await this.contract.eleccionAbierta();
    });
  }

  async cerrarEleccion(): Promise<void> {
    await this.enviarTx(() => this.contract.cerrarEleccion());
    await this.esperarCondicion(async () => {
      return !(await this.contract.eleccionAbierta());
    });
  }

  async votar(candidatoId: number): Promise<void> {
    const direccion = await this.signer.getAddress();
    await this.enviarTx(() => this.contract.votar(candidatoId));
    await this.esperarCondicion(async () => {
      return await this.contract.yaVoto(direccion);
    });
  }

  async obtenerTodosLosCandidatos(): Promise<Candidato[]> {
    const listaRaw = await this.contract.obtenerTodosLosCandidatos();
    return listaRaw.map((c: any) => ({
      id: Number(c.id),
      nombre: ethers.decodeBytes32String(c.nombre),
      votos: Number(c.votos)
    }));
  }

  async totalCandidatos(): Promise<number> {
    const total = await this.contract.totalCandidatos();
    return Number(total);
  }

  async totalVotantesAutorizados(): Promise<number> {
    const total = await this.contract.totalVotantesAutorizados();
    return Number(total);
  }

  async eleccionAbierta(): Promise<boolean> {
    return await this.contract.eleccionAbierta();
  }

  async yaVoto(direccion: string): Promise<boolean> {
    return await this.contract.yaVoto(direccion);
  }

  async esVotanteAutorizado(direccion: string): Promise<boolean> {
    return await this.contract.esVotanteAutorizado(direccion);
  }
}