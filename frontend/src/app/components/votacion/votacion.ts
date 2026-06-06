import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlockchainService, Candidato } from '../../services/blockchain';

@Component({
  selector: 'app-votacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './votacion.html',
  styleUrl: './votacion.css'
})
export class VotacionComponent implements OnInit, OnDestroy {
  cuenta: string = '';
  candidatos: Candidato[] = [];
  eleccionAbierta: boolean = false;
  nombreCandidato: string = '';
  direccionVotante: string = '';
  totalVotantesAutorizados: number = 0;
  estoyAutorizado: boolean = false;
  esAdmin: boolean = false; 
  mostrarBannerAutorizacion: boolean = false;
  mensaje: string = '';
  cargando: boolean = false;

  private mensajeTimeoutId: any = null;
  private bannerTimeoutId: any = null;

  constructor(
    private blockchain: BlockchainService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    // Al iniciar, si el servicio ya tiene una cuenta guardada, cargamos el dashboard directo
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const cuentas = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (cuentas && cuentas.length > 0) {
          this.cuenta = cuentas[0];
          await this.cargarDatos(true);
        }
      } catch (e) {
        console.warn('MetaMask no inicializado:', e);
      }
    }
  }

  ngOnDestroy() {
    if (this.mensajeTimeoutId) clearTimeout(this.mensajeTimeoutId);
    if (this.bannerTimeoutId) clearTimeout(this.bannerTimeoutId);
  }

  /**
   * Control de mensajes globales con limpieza forzada a los 5 segundos exactos
   */
  public setMensajeTemporal(texto: string) {
    if (this.mensajeTimeoutId) clearTimeout(this.mensajeTimeoutId);
    
    this.mensaje = texto;
    this.cdr.detectChanges(); 

    // El aviso crítico de voto duplicado se queda fijo sobre la boleta electoral
    if (texto.includes('Ya has votado') || texto.includes('Ya voto')) {
      return;
    }

    this.mensajeTimeoutId = setTimeout(() => {
      this.mensaje = '';
      this.mensajeTimeoutId = null;
      this.cdr.detectChanges(); 
    }, 7000); 
  }

  /**
   * Control del banner de padrón electoral con limpieza a los 5 segundos exactos
   */
  public mostrarBannerAutorizacionTemporal() {
    if (this.bannerTimeoutId) clearTimeout(this.bannerTimeoutId);
    
    this.mostrarBannerAutorizacion = true;
    this.cdr.detectChanges();

    this.bannerTimeoutId = setTimeout(() => {
      this.mostrarBannerAutorizacion = false;
      this.bannerTimeoutId = null;
      this.cdr.detectChanges(); 
    }, 8000); 
  }

  public cerrarMensaje() {
    if (this.mensajeTimeoutId) {
      clearTimeout(this.mensajeTimeoutId);
      this.mensajeTimeoutId = null;
    }
    this.mensaje = '';
    this.cdr.detectChanges();
  }

  /**
   * Desconectar la billetera de la vista actual
   */
  public desconectarWallet() {
    this.cuenta = '';
    this.esAdmin = false;
    this.estoyAutorizado = false;
    this.mostrarBannerAutorizacion = false;
    this.mensaje = '';
    this.cdr.detectChanges();
  }

  public async conectar() {
    try {
      this.cuenta = await this.blockchain.conectarMetaMask();
      this.setMensajeTemporal('Billetera conectada exitosamente.');
      await this.cargarDatos(true); 
    } catch (e: any) {
      this.setMensajeTemporal('Error: ' + e.message);
    } finally {
      this.cdr.detectChanges();
    }
  }

  public async cargarDatos(mostrarBanner: boolean = false) {
    try {
      this.eleccionAbierta = await this.blockchain.eleccionAbierta();
      this.candidatos = await this.blockchain.obtenerTodosLosCandidatos();
      this.totalVotantesAutorizados = await this.blockchain.totalVotantesAutorizados();
      
      if (this.cuenta) {
        this.estoyAutorizado = await this.blockchain.esVotanteAutorizado(this.cuenta);

        // Dirección del Administrador (Dueño del Contrato)
        const tuDireccionAdmin = '0xE60E4F42913DE6e4b0975D146d268f4A34064549'; 
        this.esAdmin = (this.cuenta.toLowerCase() === tuDireccionAdmin.toLowerCase());

        if (mostrarBanner) {
          this.mostrarBannerAutorizacionTemporal();
        }
      }
    } catch (e: any) {
      this.setMensajeTemporal('Error al cargar datos del contrato: ' + e.message);
    }
  }

  public async registrar() {
    if (!this.nombreCandidato.trim()) {
      this.setMensajeTemporal('El nombre del candidato no puede estar vacío.');
      return;
    }
    try {
      this.cargando = true;
      this.mensaje = 'Registrando candidato en la blockchain...';
      await this.blockchain.registrarCandidato(this.nombreCandidato);
      this.setMensajeTemporal('✅ Candidato registrado con éxito.');
      this.nombreCandidato = '';
    } catch (e: any) {
      console.error('Error al registrar candidato:', e);
      this.setMensajeTemporal('❌ Error: ' + (e.reason || e.shortMessage || e.message || 'desconocido'));
    } finally {
      try { await this.cargarDatos(); } catch { }
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  public async registrarVotante() {
    const direccion = this.direccionVotante.trim();
    if (!direccion) {
      this.setMensajeTemporal('⚠️ Ingresa una dirección de MetaMask para autorizar.');
      return;
    }
    if (!direccion.startsWith('0x') || direccion.length !== 42) {
      this.setMensajeTemporal('❌ La dirección no tiene el formato correcto (debe iniciar con 0x y tener 42 caracteres).');
      return;
    }
    try {
      this.cargando = true;
      this.mensaje = 'Autorizando votante en el padrón electoral...';
      await this.blockchain.registrarVotante(direccion);
      this.setMensajeTemporal('✅ Votante autorizado correctamente en el padrón.');
      this.direccionVotante = '';
    } catch (e: any) {
      console.error('Error al registrar votante:', e);
      const err = (e.reason || e.shortMessage || e.message || '').toString().toLowerCase();

      if (err.includes('ya esta autorizada')) {
        this.setMensajeTemporal('ℹ️ Esta dirección ya está autorizada en el padrón.');
      } else if (err.includes('direccion invalida')) {
        this.setMensajeTemporal('❌ La dirección proporcionada no es válida.');
      } else if (err.includes('solo admin') || err.includes('no autorizado')) {
        this.setMensajeTemporal('🚫 Solo el administrador puede registrar votantes.');
      } else if (err.includes('user rejected') || err.includes('user denied') || e.code === 4001 || e.code === 'ACTION_REJECTED') {
        this.setMensajeTemporal('ℹ️ Cancelaste la firma en MetaMask.');
      } else {
        this.setMensajeTemporal('❌ Error: ' + (e.reason || e.shortMessage || e.message || 'desconocido'));
      }
    } finally {
      try { await this.cargarDatos(); } catch { }
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  public async abrir() {
    try {
      this.cargando = true;
      this.mensaje = 'Abriendo proceso de elección...';
      await this.blockchain.abrirEleccion();
      this.setMensajeTemporal('✅ La elección ha sido abierta.');
    } catch (e: any) {
      console.error('Error al abrir elección:', e);
      const err = (e.reason || e.shortMessage || e.message || '').toString().toLowerCase();
      if (err.includes('al menos un votante')) {
        this.setMensajeTemporal('⚠️ Debes registrar al menos un votante en el padrón antes de abrir la elección.');
      } else if (err.includes('al menos un candidato')) {
        this.setMensajeTemporal('⚠️ Debes registrar al menos un candidato antes de abrir la elección.');
      } else {
        this.setMensajeTemporal('❌ Error: ' + (e.reason || e.shortMessage || e.message || 'desconocido'));
      }
    } finally {
      try { await this.cargarDatos(); } catch { }
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  public async cerrar() {
    try {
      this.cargando = true;
      this.mensaje = 'Cerrando proceso de elección...';
      await this.blockchain.cerrarEleccion();
      this.setMensajeTemporal('✅ La elección ha sido cerrada.');
    } catch (e: any) {
      console.error('Error al cerrar elección:', e);
      this.setMensajeTemporal('❌ Error: ' + (e.reason || e.shortMessage || e.message || 'desconocido'));
    } finally {
      try { await this.cargarDatos(); } catch { }
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  public async votar(id: number) {
    if (!this.eleccionAbierta) {
      this.setMensajeTemporal('⚠️ La elección no está activa en este momento.');
      return;
    }

    try {
      const autorizado = await this.blockchain.esVotanteAutorizado(this.cuenta);
      if (!autorizado) {
        this.setMensajeTemporal('🚫 Tu cuenta no está en el padrón electoral. Solicita autorización al administrador.');
        return;
      }
    } catch (e) {
      console.warn('No se pudo verificar autorización:', e);
    }

    try {
      const yaVoto = await this.blockchain.yaVoto(this.cuenta);
      if (yaVoto) {
        this.setMensajeTemporal('🚫 Ya has votado con esta cuenta. Utiliza otra cuenta para registrar un nuevo voto.');
        return;
      }
    } catch (e) {
      console.warn('No se pudo verificar voto previo:', e);
    }

    try {
      this.cargando = true;
      this.mensaje = 'Esperando confirmación de firma en MetaMask...';
      this.cdr.detectChanges();

      const tx: any = await this.blockchain.votar(id);
      
      if (tx) {
        if (typeof tx.wait === 'function') {
          this.mensaje = 'Procesando y asentando tu voto en la Blockchain (Sepolia)...';
          this.cdr.detectChanges();
          await tx.wait();
        }
      }

      this.setMensajeTemporal('✅ ¡Voto emitido con éxito y asentado en el bloque!');
    } catch (e: any) {
      const errorCompleto = (e.reason || e.shortMessage || e.message || '').toString().toLowerCase();
      console.error('Error al votar:', e);

      if (errorCompleto.includes('no estas en el padron')) {
        this.setMensajeTemporal('🚫 Tu cuenta no está en el padrón electoral.');
      } else if (errorCompleto.includes('ya has emitido tu voto') || errorCompleto.includes('ya voto')) {
        this.setMensajeTemporal('🚫 Ya has votado con esta cuenta. Utiliza otra cuenta para registrar un nuevo voto.');
      } else if (errorCompleto.includes('eleccion no esta activa') || errorCompleto.includes('la eleccion no')) {
        this.setMensajeTemporal('⚠️ La elección no está activa.');
      } else if (errorCompleto.includes('user rejected') || errorCompleto.includes('user denied') || e.code === 4001 || e.code === 'ACTION_REJECTED') {
        this.setMensajeTemporal('ℹ️ Cancelaste la firma en MetaMask. Tu voto no se emitió.');
      } else if (errorCompleto.includes('candidato invalido')) {
        this.setMensajeTemporal('❌ El candidato seleccionado no es válido.');
      } else if (errorCompleto.includes('transaction execution reverted') || errorCompleto.includes('execution reverted')) {
        this.setMensajeTemporal('🚫 La transacción fue rechazada por el contrato. Verifica que estés autorizado y que no hayas votado antes.');
      } else {
        this.setMensajeTemporal('❌ Error al emitir voto: ' + (e.reason || e.shortMessage || e.message || 'desconocido'));
      }
    } finally {
      try { await this.cargarDatos(); } catch { }
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}