/* =====================================================================
   M.O.R. — CUERPO (ESP32 + 4 ruedas tipo tanque)
   El móvil (Mor) manda órdenes por Bluetooth (BLE, servicio UART de Nordic):
     "M,izq,der\n"  velocidad de cada lado, de -100 a 100
     "S\n"          parar
     "P\n"          sigo aquí (si no llega nada en 0,6 s, se para solo)
   El cuerpo contesta cada 150 ms:
     "D,cm\n"       distancia al obstáculo de delante (sensor HC-SR04)
     "V,mV\n"       voltaje de la batería
   Placa: ESP32 DevKit (núcleo Arduino-ESP32 2.x o 3.x).
   Puente de motores: TB6612FNG (izquierda = canal A, derecha = canal B).
   ===================================================================== */
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---- pines (cámbialos si cableas distinto) ----
const int AIN1 = 25, AIN2 = 26, PWMA = 27;   // motores izquierdos
const int BIN1 = 33, BIN2 = 32, PWMB = 13;   // motores derechos
const int STBY = 4;                          // TB6612 en marcha
const int TRIG = 5, ECHO = 18;               // HC-SR04 (ECHO con divisor a 3,3 V)
const int BAT  = 34;                         // batería con divisor 100k / 33k
const int VEL_MAX = 255;                     // baja este número si va demasiado rápido

#define SERVICIO "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define RX_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   // el móvil escribe aquí
#define TX_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   // el cuerpo avisa por aquí

BLECharacteristic *tx;
volatile bool conectado = false;
volatile unsigned long ultimaOrden = 0;
String buf = "";

void motor(int in1, int in2, int pwm, int v) {          // v de -100 a 100
  v = constrain(v, -100, 100);
  int d = map(abs(v), 0, 100, 0, VEL_MAX);
  digitalWrite(in1, v > 0 ? HIGH : LOW);
  digitalWrite(in2, v < 0 ? HIGH : LOW);
  analogWrite(pwm, v == 0 ? 0 : d);
}
void mover(int izq, int der) { motor(AIN1, AIN2, PWMA, izq); motor(BIN1, BIN2, PWMB, der); }
void parar() { mover(0, 0); }

void orden(String s) {
  s.trim(); if (!s.length()) return;
  ultimaOrden = millis();
  if (s[0] == 'S') { parar(); return; }
  if (s[0] == 'P') return;
  if (s[0] == 'M') {
    int a = s.indexOf(','), b = s.indexOf(',', a + 1);
    if (a < 0 || b < 0) return;
    mover(s.substring(a + 1, b).toInt(), s.substring(b + 1).toInt());
  }
}

class Conexion : public BLEServerCallbacks {
  void onConnect(BLEServer *s) { conectado = true; }
  void onDisconnect(BLEServer *s) { conectado = false; parar(); delay(200); s->getAdvertising()->start(); }
};
class Recibir : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) {
    String v = String(c->getValue().c_str());
    for (size_t i = 0; i < v.length(); i++) { char ch = v[i]; if (ch == '\n') { orden(buf); buf = ""; } else buf += ch; }
    if (buf.length() > 40) buf = "";
  }
};

long distancia() {
  digitalWrite(TRIG, LOW); delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10); digitalWrite(TRIG, LOW);
  long t = pulseIn(ECHO, HIGH, 25000);        // como mucho ~4 m
  return t ? t / 58 : 400;
}

void setup() {
  pinMode(AIN1, OUTPUT); pinMode(AIN2, OUTPUT); pinMode(PWMA, OUTPUT);
  pinMode(BIN1, OUTPUT); pinMode(BIN2, OUTPUT); pinMode(PWMB, OUTPUT);
  pinMode(STBY, OUTPUT); digitalWrite(STBY, HIGH);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  parar();
  BLEDevice::init("MOR-CUERPO");
  BLEServer *srv = BLEDevice::createServer(); srv->setCallbacks(new Conexion());
  BLEService *svc = srv->createService(SERVICIO);
  tx = svc->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY); tx->addDescriptor(new BLE2902());
  BLECharacteristic *rx = svc->createCharacteristic(RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new Recibir());
  svc->start();
  BLEAdvertising *ad = BLEDevice::getAdvertising(); ad->addServiceUUID(SERVICIO); ad->setScanResponse(true); BLEDevice::startAdvertising();
}

unsigned long ultAviso = 0;
void loop() {
  if (millis() - ultimaOrden > 600) parar();          // seguridad: sin órdenes, quieto
  if (conectado && millis() - ultAviso > 150) {
    ultAviso = millis();
    long d = distancia();
    long mv = (long)(analogReadMilliVolts(BAT) * (133.0 / 33.0));
    String s = "D," + String(d) + "\nV," + String(mv) + "\n";
    tx->setValue((uint8_t*)s.c_str(), s.length()); tx->notify();
  }
  delay(10);
}
