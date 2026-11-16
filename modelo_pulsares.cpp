/**
 * modelo_pulsares.cpp — Modelaje Matemático y Simulación Numérica de Púlsares en C++
 * Autor: Rubén Concepción (8-1026-1720)
 * Profesor: Eduardo Camacho | Materia: Ciencia del Espacio y la Tierra
 * Escuela de Física, Facultad de Ciencias Naturales, Exactas y Tecnología — Universidad de Panamá
 *
 * Modelos implementados (compatibles con las ecuaciones LaTeX del Póster y del PDF):
 *   1. Radio del Cilindro de Luz Relativista: R_LC = c / Omega = (c * P) / (2 * pi)
 *   2. Densidad Crítica de Estabilidad Rotacional (Gold, 1968): rho_min = (3 * pi) / (G * P^2)
 *   3. Potencia Radiada por Frenado Magnético Dipolar (Pacini, 1967): dE/dt = 4 * pi^2 * I * P_dot / P^3
 *   4. Campo Magnético Superficial Característico: B_s = 3.2e19 * sqrt(P * P_dot) [Gauss]
 *   5. Edad Característica de Frenado Espín-Dipolo: tau_c = P / (2 * P_dot)
 *   6. Decaimiento Orbital por Ondas Gravitacionales (Hulse y Taylor, 1975 — PSR B1913+16)
 */

#include <iostream>
#include <iomanip>
#include <cmath>
#include <vector>
#include <string>

// Constantes físicas fundamentales en unidades CGS y SI
constexpr double PI = 3.14159265358979323846;
constexpr double C_LIGHT_KM_S = 299792.458;        // Velocidad de la luz [km/s]
constexpr double C_LIGHT_CGS  = 2.99792458e10;     // Velocidad de la luz [cm/s]
constexpr double G_CGS        = 6.67430e-8;        // Constante gravitacional [cm^3 g^-1 s^-2]
constexpr double M_SUN_CGS    = 1.98847e33;        // Masa solar [g]
constexpr double I_CANONICAL  = 1.0e45;            // Momento de inercia canónico [g cm^2] (10^38 kg m^2)
constexpr double SEC_PER_YEAR = 3.15576e7;         // Segundos en un año juliano

struct PulsarData {
    std::string nombre;
    std::string descubridores;
    double periodo_s;       // P [s]
    double p_dot;           // dP/dt [s/s]
    double radio_km;        // R [km]
};

// 1. Radio del Cilindro de Luz Relativista [km]
double calcularRadioCilindroLuzKm(double P) {
    return (C_LIGHT_KM_S * P) / (2.0 * PI);
}

// 2. Densidad Mínima de Estabilidad Rotacional contra Ruptura Centrífuga [g/cm^3]
double calcularDensidadMinimaCGS(double P) {
    return (3.0 * PI) / (G_CGS * P * P);
}

// 3. Potencia de Frenado Rotacional (Luminosidad de Spin-Down) [erg/s]
double calcularPotenciaFrenadoErgS(double P, double p_dot) {
    return 4.0 * PI * PI * I_CANONICAL * p_dot / (P * P * P);
}

// 4. Campo Magnético Dipolar Superficial Característico [Gauss]
double calcularCampoMagneticoGauss(double P, double p_dot) {
    return 3.2e19 * std::sqrt(P * p_dot);
}

// 5. Edad Característica de Frenado Dipolar (n = 3) [años]
double calcularEdadCaracteristicaAnios(double P, double p_dot) {
    return (P / (2.0 * p_dot)) / SEC_PER_YEAR;
}

// 6. Velocidad Ecuatorial Lineal como fracción de la velocidad de la luz (v_eq / c)
double calcularFraccionVelocidadLuzEcuatorial(double P, double R_km) {
    double v_eq_km_s = (2.0 * PI * R_km) / P;
    return v_eq_km_s / C_LIGHT_KM_S;
}

// 7. Decaimiento Orbital Relativista de Hulse-Taylor (PSR B1913+16) [s/s]
double calcularDecaimientoOrbitalRelativista(double m1_sun, double m2_sun, double Pb_s, double e) {
    double M_total = (m1_sun + m2_sun) * M_SUN_CGS;
    double mu = (m1_sun * m2_sun * M_SUN_CGS * M_SUN_CGS) / M_total;
    double chirp_mass = std::pow(mu, 3.0 / 5.0) * std::pow(M_total, 2.0 / 5.0);

    double factor_e = (1.0 + (73.0 / 24.0) * e * e + (37.0 / 96.0) * std::pow(e, 4))
                      / std::pow(1.0 - e * e, 3.5);

    double termino_masa = (G_CGS * chirp_mass) / std::pow(C_LIGHT_CGS, 3.0);
    double termino_periodo = Pb_s / (2.0 * PI);

    return -(192.0 * PI / 5.0) * std::pow(termino_masa, 5.0 / 3.0)
                               * std::pow(termino_periodo, -5.0 / 3.0)
                               * factor_e;
}

int main() {
    std::vector<PulsarData> catalogo = {
        {"CP 1919 (PSR B1919+21)",     "Hewish, Bell et al. (1968)",     1.33730216, 1.348e-15, 10.0},
        {"PSR B0531+21 (Cangrejo)",    "Staelin y Reifenstein (1968)",   0.03339241, 4.210e-13, 10.0},
        {"PSR B0833-45 (Vela)",        "Large, Vaughan y Mills (1968)",  0.08932839, 1.250e-13, 10.0},
        {"PSR B1509-58 (Mano de Dios)","Observatorio Chandra (2014)",    0.15158280, 1.536e-12,  9.5},
        {"PSR B1937+21 (1er MSP)",     "Backer et al. (1982)",           0.00155781, 1.051e-19, 10.0},
        {"PSR B1257+12 (Exoplanetas)", "Wolszczan y Frail (1992)",       0.00621853, 1.143e-19, 10.0},
        {"PSR J1748-2446ad (716 Hz)",  "Hessels et al. (2006)",          0.00139595, 1.000e-20, 10.0}
    };

    std::cout << "=========================================================================================\n";
    std::cout << "  UNIVERSIDAD DE PANAMA - ESCUELA DE FISICA - CIENCIA DEL ESPACIO Y LA TIERRA\n";
    std::cout << "  MODELAJE ASTROFISICO DE PULSARES EN C++ | Autor: Ruben Concepcion (8-1026-1720)\n";
    std::cout << "=========================================================================================\n\n";

    std::cout << std::left << std::setw(28) << "Pulsar"
              << std::right << std::setw(12) << "P [s]"
              << std::setw(14) << "R_LC [km]"
              << std::setw(15) << "B_s [Gauss]"
              << std::setw(15) << "dE/dt [erg/s]"
              << std::setw(11) << "v_eq / c" << "\n";
    std::cout << std::string(95, '-') << "\n";

    for (const auto& p : catalogo) {
        double r_lc = calcularRadioCilindroLuzKm(p.periodo_s);
        double b_s  = calcularCampoMagneticoGauss(p.periodo_s, p.p_dot);
        double edot = calcularPotenciaFrenadoErgS(p.periodo_s, p.p_dot);
        double beta = calcularFraccionVelocidadLuzEcuatorial(p.periodo_s, p.radio_km);

        std::cout << std::left << std::setw(28) << p.nombre
                  << std::right << std::fixed << std::setprecision(6) << std::setw(12) << p.periodo_s
                  << std::scientific << std::setprecision(2)
                  << std::setw(14) << r_lc
                  << std::setw(15) << b_s
                  << std::setw(15) << edot
                  << std::fixed << std::setprecision(4)
                  << std::setw(11) << beta << "\n";
    }

    // Verificación del Púlsar Binario de Hulse y Taylor (PSR B1913+16)
    double Pb_hulse_taylor = 27906.980895; // 7.75 horas en segundos
    double ecc_ht          = 0.6171334;
    double pb_dot          = calcularDecaimientoOrbitalRelativista(1.4398, 1.3886, Pb_hulse_taylor, ecc_ht);

    std::cout << "\n-----------------------------------------------------------------------------------------\n";
    std::cout << "Verificacion de Ondas Gravitacionales en PSR B1913+16 (Hulse y Taylor, 1975):\n";
    std::cout << "  Derivada del periodo orbital predicha por Relatividad General (dPb/dt): "
              << std::scientific << std::setprecision(4) << pb_dot << " s/s\n";
    std::cout << "=========================================================================================\n";

    return 0;
}