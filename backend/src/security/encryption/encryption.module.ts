import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Global: el cifrado de campos sensibles se necesita en transportes,
 * forwarding y monitoreo por igual, y la clave maestra debe derivarse una
 * sola vez por proceso (PBKDF2 de 100k iteraciones no es gratis).
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
