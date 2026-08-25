'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { leerSesion } from '@/lib/api';

type ResultadoImport = {
  importados: number;
  errores: Array<{ fila: number; error: string }>;
  total: number;
};

const TIPOS_CATALOGOS = [
  { id: 'clientes', nombre: 'Clientes' },
  { id: 'proveedores', nombre: 'Proveedores' },
  { id: 'unidades', nombre: 'Unidades' },
  { id: 'operadores', nombre: 'Operadores' },
  { id: 'puertos', nombre: 'Puertos' },
  { id: 'tipos-negocio', nombre: 'Tipos de Negocio' },
  { id: 'tipos-unidad', nombre: 'Tipos de Unidad' },
  { id: 'tipos-mercancia', nombre: 'Tipos de Mercancía' },
  { id: 'rutas', nombre: 'Rutas' },
  { id: 'tarifas', nombre: 'Tarifas' },
];

export function BulkImportDialog() {
  const [abierto, setAbierto] = useState(false);
  const [tipoCatalogo, setTipoCatalogo] = useState('clientes');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manejarCarga = async () => {
    if (!archivo) {
      setError('Selecciona un archivo CSV');
      return;
    }

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const sesion = leerSesion();
      if (!sesion?.accessToken) {
        throw new Error('No estás autenticado');
      }

      const formData = new FormData();
      formData.append('archivo', archivo);

      const response = await fetch(
        `${API_URL}/api/v1/catalogos/${tipoCatalogo}/bulk-import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sesion.accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const datos = await response.json();
        throw new Error(datos.message || 'Error al importar');
      }

      const datos = await response.json();
      setResultado(datos);
      setArchivo(null);
    } catch (err) {
      setError((err as Error).message || 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = () => {
    const plantillas: Record<string, string[]> = {
      clientes: ['nombre', 'diasCredito', 'celular', 'contacto'],
      proveedores: ['nombre', 'tipo', 'diasPago', 'contacto'],
      unidades: ['economico', 'marca', 'modelo'],
      operadores: ['nombreCompleto', 'celular', 'rfc', 'curp'],
      puertos: ['nombre', 'ciudad', 'pais'],
      'tipos-negocio': ['nombre'],
      'tipos-unidad': ['nombre', 'full'],
      'tipos-mercancia': ['nombre', 'clase'],
      rutas: ['codigo', 'origen', 'destino', 'km'],
      tarifas: ['clienteId', 'origen', 'destino', 'tarifaVenta'],
    };

    const encabezados = plantillas[tipoCatalogo] || [];
    const csv = encabezados.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-${tipoCatalogo}.csv`;
    a.click();
  };

  if (!API_URL) return null;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Importar CSV
      </button>

      {abierto && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Importar Catálogo en Lote</h3>

          <div className="mb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipo de Catálogo
              </label>
              <select
                value={tipoCatalogo}
                onChange={(e) => setTipoCatalogo(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              >
                {TIPOS_CATALOGOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Archivo CSV
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="mt-1 w-full"
                disabled={cargando}
              />
              <p className="mt-1 text-xs text-gray-500">
                Formato: CSV con encabezados. {archivo && `(${archivo.name})`}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={descargarPlantilla}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Descargar Plantilla
              </button>
              <button
                onClick={manejarCarga}
                disabled={cargando || !archivo}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:bg-gray-400 hover:bg-blue-700"
              >
                {cargando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {resultado && (
            <div className="space-y-2 rounded-md bg-green-50 p-3">
              <p className="font-medium text-green-800">
                ✓ Importación completada
              </p>
              <p className="text-sm text-green-700">
                Importados: <strong>{resultado.importados}</strong> / {resultado.total}
              </p>
              {resultado.errores.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Errores ({resultado.errores.length}):
                  </p>
                  <ul className="mt-1 space-y-1 text-xs text-red-600">
                    {resultado.errores.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        Fila {e.fila}: {e.error}
                      </li>
                    ))}
                    {resultado.errores.length > 5 && (
                      <li>... y {resultado.errores.length - 5} errores más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
