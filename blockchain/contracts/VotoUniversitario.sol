pragma solidity 0.8.24;

contract VotoUniversitario {
    struct Candidato {
        uint32 id;
        bytes32 nombre;
        uint32 votos;
    }

    address public administrador;
    bool public eleccionAbierta;
    uint32 public totalCandidatos;
    uint32 public totalVotantesAutorizados;

    mapping(uint32 => Candidato) public candidatos;
    mapping(address => bool) public yaVoto;
    mapping(address => bool) public votanteAutorizado;

    event CandidatoRegistrado(uint32 indexed id, bytes32 nombre);
    event VotoEmitido(address indexed votante, uint32 indexed candidatoId);
    event EleccionAbierta();
    event EleccionCerrada();
    event VotanteRegistrado(address indexed votante);

    modifier soloAdministrador() {
        require(msg.sender == administrador, "No autorizado: Solo admin");
        _;
    }

    modifier eleccionActiva() {
        require(eleccionAbierta, "La eleccion no esta activa");
        _;
    }

    modifier soloVotanteAutorizado() {
        require(
            votanteAutorizado[msg.sender],
            "No autorizado: No estas en el padron electoral"
        );
        _;
    }

    constructor() {
        administrador = msg.sender;
        eleccionAbierta = false;
        totalCandidatos = 0;
        totalVotantesAutorizados = 0;
    }

    function registrarCandidato(bytes32 _nombre) public soloAdministrador {
        require(!eleccionAbierta, "Eleccion abierta: No se admiten candidatos");
        require(_nombre != bytes32(0), "El nombre no puede estar vacio");

        totalCandidatos++;
        candidatos[totalCandidatos] = Candidato(totalCandidatos, _nombre, 0);
        emit CandidatoRegistrado(totalCandidatos, _nombre);
    }

    function registrarVotante(address _votante) public soloAdministrador {
        require(_votante != address(0), "Direccion invalida");
        require(
            !votanteAutorizado[_votante],
            "Esta direccion ya esta autorizada"
        );

        votanteAutorizado[_votante] = true;
        totalVotantesAutorizados++;
        emit VotanteRegistrado(_votante);
    }

    function registrarVotantesEnLote(
        address[] calldata _votantes
    ) public soloAdministrador {
        for (uint256 i = 0; i < _votantes.length; i++) {
            address v = _votantes[i];
            if (v != address(0) && !votanteAutorizado[v]) {
                votanteAutorizado[v] = true;
                totalVotantesAutorizados++;
                emit VotanteRegistrado(v);
            }
        }
    }

    function abrirEleccion() public soloAdministrador {
        require(totalCandidatos > 0, "Debe haber al menos un candidato");
        require(
            totalVotantesAutorizados > 0,
            "Debe haber al menos un votante autorizado"
        );
        require(!eleccionAbierta, "La eleccion ya esta abierta");
        eleccionAbierta = true;
        emit EleccionAbierta();
    }

    function cerrarEleccion() public soloAdministrador {
        require(eleccionAbierta, "La eleccion ya esta cerrada");
        eleccionAbierta = false;
        emit EleccionCerrada();
    }

    function votar(
        uint32 _candidatoId
    ) public eleccionActiva soloVotanteAutorizado {
        require(!yaVoto[msg.sender], "Ya has emitido tu voto");
        require(
            _candidatoId > 0 && _candidatoId <= totalCandidatos,
            "Candidato invalido"
        );

        yaVoto[msg.sender] = true;
        candidatos[_candidatoId].votos++;
        emit VotoEmitido(msg.sender, _candidatoId);
    }

    function obtenerTodosLosCandidatos()
        public
        view
        returns (Candidato[] memory)
    {
        Candidato[] memory lista = new Candidato[](totalCandidatos);
        for (uint32 i = 1; i <= totalCandidatos; i++) {
            lista[i - 1] = candidatos[i];
        }
        return lista;
    }

    function esVotanteAutorizado(address _votante) public view returns (bool) {
        return votanteAutorizado[_votante];
    }
}
