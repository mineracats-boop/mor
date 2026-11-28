# Cuerpo de M.O.R. (4 ruedas, tipo tanque)

El móvil va delante, con la pantalla (los ojos) y la cámara de delante mirando hacia donde avanza.
El móvil es el cerebro; la placa ESP32 solo mueve las ruedas y mide la distancia a lo que tiene delante.

## Piezas (unos 35–45 € en total)
| Pieza | Para qué |
|---|---|
| Chasis 4WD con 4 motores TT y ruedas (kit de Arduino) | el cuerpo |
| ESP32 DevKit V1 (o similar) | habla con el móvil por Bluetooth y mueve los motores |
| Puente de motores TB6612FNG | da fuerza a los motores (los dos de cada lado juntos) |
| Sensor de distancia HC-SR04 | ve obstáculos delante |
| 2 baterías 18650 + portapilas con interruptor (7,4 V) | energía de los motores |
| Regulador de 5 V (LM2596 o un mini step-down) | alimenta la ESP32 desde la batería |
| Resistencias 100 kΩ y 33 kΩ | medir la batería |
| Resistencias 1 kΩ y 2 kΩ | bajar a 3,3 V la señal ECHO del sensor |
| Soporte de móvil (tipo coche) atornillado delante | sujetar a Mor |
| Cables dupont | conexiones |

El móvil usa su propia batería (o una powerbank pequeña).

## Conexiones
| ESP32 | va a |
|---|---|
| 25, 26 | TB6612 AIN1, AIN2 |
| 27 | TB6612 PWMA |
| 33, 32 | TB6612 BIN1, BIN2 |
| 13 | TB6612 PWMB |
| 4 | TB6612 STBY |
| 5 | HC-SR04 TRIG |
| 18 | HC-SR04 ECHO (con el divisor 1 kΩ / 2 kΩ) |
| 34 | punto medio del divisor 100 kΩ (a la batería +) / 33 kΩ (a GND) |
| VIN / 5V | salida del regulador de 5 V |
| GND | GND común de todo |

TB6612: A01/A02 a los dos motores de la izquierda (en paralelo), B01/B02 a los dos de la derecha, VM a la batería (7,4 V), VCC a 3,3 V de la ESP32.

## Programar la placa
1. Instala Arduino IDE y añade la placa «esp32 by Espressif» (Gestor de placas).
2. Abre `mor_cuerpo.ino`, elige «ESP32 Dev Module» y súbelo.
3. En Mor (modo robot): menú ⚙ → «Conectar el cuerpo» → elige **MOR-CUERPO**.
4. En modo IA, `/cuerpo` tiene botones para probar adelante, atrás y giros. Si una rueda gira al revés, cambia sus dos cables o marca «invertir» en ese panel.

## Seguridad
- Si el móvil deja de mandar órdenes 0,6 s, el cuerpo se para solo.
- Mor se para si ve un obstáculo a menos de 20 cm, si lo levantan o vuelcan, o si le dices «Mor, quieto».
- Velocidad máxima limitada al 60 % desde Mor.
