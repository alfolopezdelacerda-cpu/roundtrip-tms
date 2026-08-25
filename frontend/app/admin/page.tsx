"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { ClaveCatalogo } from "@/lib/catalogos";
import type { NuevoUsuario } from "@/lib/datos";
import { ROLES_USUARIO, type RolUsuario, type Usuario } from "@/lib/types";
import { Card, Empty, PageTitle } from "@/components/ui";
import { BulkImportDialog } from "@/components/bulk-import";

type TipoCampo = "texto" | "numero" | "select" | "check";

type CampoCatalogo = {
  clave: string;
  titulo: string;
  tipo: TipoCampo;
  opciones?: string[];
  ancho?: string;
  /** Valor con el que nace el campo al dar de alta un registro. */
  inicial?: string | number | boolean;
};

type DefinicionCatalogo = {
  clave: ClaveCatalogo;
  titulo: string;
  descripcion: string;
  campos: CampoCatalogo[];
};

/**
 * Definición declarativa de cada catálogo: la tabla, el alta y la edición se
 * generan a partir de aquí, así que agregar un catálogo nuevo es agregar una
 * entrada a esta lista.
 */
const CATALOGOS: DefinicionCatalogo[] = [
  {
    clave: "clientes",
    titulo: "Clientes",
    descripcion: "Alimenta el alta de viaje y define los días de crédito de CXC.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "rfc", titulo: "RFC", tipo: "texto", ancho: "w-40" },
      // Obligatorios para emitir CFDI 4.0 al cliente.
      { clave: "regimenFiscal", titulo: "Régimen", tipo: "texto", ancho: "w-24" },
      { clave: "codigoPostal", titulo: "CP", tipo: "texto", ancho: "w-24" },
      { clave: "diasCredito", titulo: "Días crédito", tipo: "numero", inicial: 30 },
    ],
  },
  {
    clave: "proveedores",
    titulo: "Proveedores",
    descripcion: "Quienes ejecutan los servicios FWD y generan cuentas por pagar.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      {
        clave: "tipo",
        titulo: "Tipo",
        tipo: "select",
        opciones: ["transportista", "agente_aduanal", "almacen"],
        inicial: "transportista",
      },
      { clave: "diasPago", titulo: "Días pago", tipo: "numero", inicial: 30 },
      { clave: "contacto", titulo: "Contacto", tipo: "texto" },
    ],
  },
  {
    clave: "unidades",
    titulo: "Unidades",
    descripcion: "Flota propia disponible para los servicios TDC.",
    campos: [
      { clave: "economico", titulo: "Económico", tipo: "texto", ancho: "w-32" },
      { clave: "placas", titulo: "Placas", tipo: "texto", ancho: "w-36" },
      {
        clave: "tipo",
        titulo: "Tipo",
        tipo: "select",
        opciones: ["full_trailer", "sencillo", "rabon", "pickup"],
        inicial: "full_trailer",
      },
      { clave: "capacidadTon", titulo: "Ton", tipo: "numero", inicial: 30 },
      {
        clave: "estado",
        titulo: "Estado",
        tipo: "select",
        opciones: ["operativo", "mantenimiento", "fuera_servicio", "vendido"],
        inicial: "operativo",
      },
      // Datos que exige el complemento Carta Porte para emitir.
      { clave: "configVehicular", titulo: "Config. SAT", tipo: "texto", ancho: "w-28" },
      { clave: "permisoSct", titulo: "Permiso SCT", tipo: "texto", ancho: "w-28" },
      { clave: "numPermisoSct", titulo: "Núm. permiso", tipo: "texto", ancho: "w-36" },
      { clave: "anio", titulo: "Modelo", tipo: "numero", inicial: 2020 },
      { clave: "aseguradoraCivil", titulo: "Aseguradora", tipo: "texto", ancho: "w-36" },
      { clave: "polizaCivil", titulo: "Póliza", tipo: "texto", ancho: "w-32" },
    ],
  },
  {
    clave: "operadores",
    titulo: "Operadores",
    descripcion:
      "Personal de conducción de la transportadora. El expediente completo se captura en RRHH › Operadores.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "licencia", titulo: "Licencia", tipo: "texto", ancho: "w-36" },
      { clave: "celular", titulo: "Celular", tipo: "texto", ancho: "w-36" },
      { clave: "rfc", titulo: "RFC", tipo: "texto", ancho: "w-36" },
      {
        clave: "estado",
        titulo: "Estado",
        tipo: "select",
        opciones: ["activo", "inactivo", "suspendido", "baja"],
        inicial: "activo",
      },
    ],
  },
  {
    clave: "rutas",
    titulo: "Rutas",
    descripcion:
      "Rutas frecuentes con su código; Asignación TDC las usa para autocompletar km y casetas proyectados.",
    campos: [
      { clave: "codigo", titulo: "Código", tipo: "texto", ancho: "w-32" },
      { clave: "origen", titulo: "Origen", tipo: "texto" },
      { clave: "destino", titulo: "Destino", tipo: "texto" },
      { clave: "kmProyectados", titulo: "Km proyectados", tipo: "numero", inicial: 0 },
      {
        clave: "casetasProyectadas",
        titulo: "Casetas proyectadas",
        tipo: "numero",
        inicial: 0,
      },
    ],
  },
  {
    clave: "puertos",
    titulo: "Puertos",
    descripcion: "Puertos y cruces fronterizos del campo Puerto.",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
  {
    clave: "tiposNegocio",
    titulo: "Tipos de negocio",
    descripcion: "Dedicado, expo, impo, local…",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
  {
    clave: "tiposUnidad",
    titulo: "Tipos de unidad",
    descripcion: "Marcar «full» habilita el segundo contenedor en el alta.",
    campos: [
      { clave: "nombre", titulo: "Nombre", tipo: "texto" },
      { clave: "full", titulo: "Full", tipo: "check", inicial: false },
    ],
  },
  {
    clave: "tiposMercancia",
    titulo: "Tipos de mercancía",
    descripcion: "Clasificación de la carga.",
    campos: [{ clave: "nombre", titulo: "Nombre", tipo: "texto" }],
  },
];

/** Secciones del panel: los catálogos, más usuarios y permisos. */
type Seccion = ClaveCatalogo | "usuarios" | "permisos";

/**
 * Administrador oculto. No aparece en el menú: se entra dando tres clics
 * seguidos al logo. Reúne todo lo que se configura sin tocar código:
 * catálogos de la operación, usuarios y el reparto de permisos.
 */
export default function Admin() {
  const [activa, setActiva] = useState<Seccion>("usuarios");
  const definicion = CATALOGOS.find((c) => c.clave === activa);

  const pestañas: { clave: Seccion; titulo: string }[] = [
    { clave: "usuarios", titulo: "Usuarios" },
    { clave: "permisos", titulo: "Permisos" },
    ...CATALOGOS.map((c) => ({ clave: c.clave as Seccion, titulo: c.titulo })),
  ];

  return (
    <>
      <PageTitle
        title="Administrador"
        subtitle="Usuarios, permisos y catálogos del sistema. Solo accesible desde el logo."
        action={
          <Link
            href="/"
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-black/[0.03]"
          >
            Salir
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {pestañas.map((t) => (
          <button
            key={t.clave}
            onClick={() => setActiva(t.clave)}
            className={`rounded-md px-3 py-1.5 text-sm ring-1 ring-inset transition-colors ${
              activa === t.clave
                ? "bg-ink text-white ring-transparent"
                : "bg-white ring-[#DEE3DD] hover:bg-black/[0.03]"
            }`}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      {activa === "usuarios" ? <PanelUsuarios /> : null}
      {activa === "permisos" ? <PanelPermisos /> : null}
      {definicion ? (
        <>
          <div className="mb-4">
            <BulkImportDialog />
          </div>
          <TablaCatalogo key={definicion.clave} definicion={definicion} />
        </>
      ) : null}
    </>
  );
}

function TablaCatalogo({ definicion }: { definicion: DefinicionCatalogo }) {
  const store = useStore();
  const { agregarCatalogo, actualizarCatalogo, eliminarCatalogo, usosDeCatalogo } = store;

  const registros = store[definicion.clave] as unknown as Array<
    { id: string; activo: boolean } & Record<string, unknown>
  >;

  const [nuevo, setNuevo] = useState<Record<string, unknown>>(() => inicial(definicion));
  const [aviso, setAviso] = useState<string | null>(null);

  async function alta(e: React.FormEvent) {
    e.preventDefault();
    const principal = definicion.campos[0].clave;
    if (!String(nuevo[principal] ?? "").trim()) {
      setAviso(`${definicion.campos[0].titulo} es obligatorio.`);
      return;
    }
    await agregarCatalogo(definicion.clave, nuevo);
    setNuevo(inicial(definicion));
    setAviso(null);
  }

  async function borrar(id: string) {
    try {
      // Quien decide si se borra o se desactiva es el backend: es el único
      // que sabe con certeza cuántos servicios lo referencian.
      const resultado = await eliminarCatalogo(definicion.clave, id);
      setAviso(
        resultado.desactivado
          ? `Ese registro lo usan ${resultado.usos} servicio(s). Se desactivó en vez de borrarse.`
          : null,
      );
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  return (
    <>
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm text-muted">{definicion.descripcion}</p>
        <form onSubmit={alta} className="flex flex-wrap items-end gap-2">
          {definicion.campos.map((c) => (
            <div key={c.clave}>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                {c.titulo}
              </label>
              <Entrada
                campo={c}
                valor={nuevo[c.clave]}
                onChange={(v) => setNuevo((n) => ({ ...n, [c.clave]: v }))}
              />
            </div>
          ))}
          <button
            type="submit"
            className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Agregar
          </button>
        </form>
        {aviso ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            {aviso}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {registros.length === 0 ? (
          <Empty>Este catálogo está vacío.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {definicion.campos.map((c) => (
                    <th key={c.clave} className="px-4 py-2.5 font-medium">
                      {c.titulo}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 font-medium">Usos</th>
                  <th className="px-4 py-2.5 font-medium">Activo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {registros.map((r) => (
                  <tr key={r.id} className={r.activo ? "" : "opacity-50"}>
                    {definicion.campos.map((c) => (
                      <td key={c.clave} className="px-4 py-2">
                        <Entrada
                          campo={c}
                          valor={r[c.clave]}
                          onChange={(v) =>
                            actualizarCatalogo(definicion.clave, r.id, { [c.clave]: v })
                          }
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 tabular-nums text-muted">
                      {usosDeCatalogo(definicion.clave, r.id)}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={r.activo}
                        onChange={(e) =>
                          actualizarCatalogo(definicion.clave, r.id, {
                            activo: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-[#C97A0F]"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => borrar(r.id)}
                        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-rose-50 hover:text-rose-700"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Un registro en uso no se borra:
        se desactiva, y deja de ofrecerse en el alta de viaje sin romper los
        servicios que ya lo usan.
      </p>
    </>
  );
}

function Entrada({
  campo,
  valor,
  onChange,
}: {
  campo: CampoCatalogo;
  valor: unknown;
  onChange: (v: string | number | boolean) => void;
}) {
  const base = `rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-amber ${
    campo.ancho ?? "w-full min-w-40"
  }`;

  if (campo.tipo === "check") {
    return (
      <input
        type="checkbox"
        checked={Boolean(valor)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#C97A0F]"
      />
    );
  }

  if (campo.tipo === "select") {
    return (
      <select
        className={base}
        value={String(valor ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {campo.opciones?.map((o) => (
          <option key={o} value={o}>
            {o.replace("_", " ")}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={campo.tipo === "numero" ? "number" : "text"}
      className={base}
      value={String(valor ?? "")}
      onChange={(e) =>
        onChange(campo.tipo === "numero" ? Number(e.target.value) : e.target.value)
      }
    />
  );
}

function inicial(definicion: DefinicionCatalogo): Record<string, unknown> {
  return Object.fromEntries(
    definicion.campos.map((c) => [c.clave, c.inicial ?? (c.tipo === "numero" ? 0 : "")]),
  );
}

// ============================================
// Usuarios y permisos
// ============================================

const campoUsuario =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber";

/**
 * Alta, edición y baja de usuarios sin tocar código. El rol es el permiso:
 * `RolesGuard` lo evalúa en cada endpoint, así que cambiarlo aquí cambia de
 * inmediato lo que esa persona puede hacer.
 */
function PanelUsuarios() {
  const store = useStore();
  const { modo, listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } = store;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(await listarUsuarios());
      setAviso(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudieron cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }, [listarUsuarios]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /** Envuelve una acción para que el error del backend se lea en pantalla. */
  async function intentar(accion: () => Promise<unknown>) {
    try {
      setAviso(null);
      await accion();
      await recargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "La operación falló");
    }
  }

  if (modo === "demo") {
    return (
      <Card>
        <Empty>
          La administración de usuarios necesita el backend. El modo demostración
          corre sin sesión, así que no hay cuentas que administrar.
        </Empty>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            El rol define qué puede hacer cada persona. Consulta la pestaña
            «Permisos» para ver el reparto exacto.
          </p>
          <button
            onClick={() => setNuevo((v) => !v)}
            className="rounded-md bg-amber px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {nuevo ? "Cancelar" : "+ Nuevo usuario"}
          </button>
        </div>

        {nuevo ? (
          <FormularioUsuario
            onGuardar={async (datos) => {
              await intentar(() => crearUsuario(datos));
              setNuevo(false);
            }}
          />
        ) : null}

        {aviso ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            {aviso}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {cargando ? (
          <Empty>Cargando usuarios…</Empty>
        ) : usuarios.length === 0 ? (
          <Empty>No hay usuarios registrados.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Usuario</th>
                  <th className="px-4 py-2.5 font-medium">Correo</th>
                  <th className="px-4 py-2.5 font-medium">Rol</th>
                  <th className="px-4 py-2.5 font-medium">Activo</th>
                  <th className="px-4 py-2.5 font-medium">MFA</th>
                  <th className="px-4 py-2.5 font-medium">Último acceso</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE3DD]">
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{u.username}</p>
                      {u.firstName || u.lastName ? (
                        <p className="text-xs text-muted">
                          {`${u.firstName} ${u.lastName}`.trim()}
                        </p>
                      ) : null}
                      {u.bloqueado ? (
                        <p className="text-xs font-medium text-rose-700">
                          Bloqueado por intentos fallidos
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        className="rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-amber"
                        value={u.role}
                        onChange={(e) =>
                          intentar(() =>
                            actualizarUsuario(u.id, {
                              role: e.target.value as RolUsuario,
                            }),
                          )
                        }
                      >
                        {ROLES_USUARIO.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={u.isActive}
                        onChange={(e) =>
                          intentar(() =>
                            actualizarUsuario(u.id, { isActive: e.target.checked }),
                          )
                        }
                        className="h-4 w-4 accent-[#C97A0F]"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {u.mfaEnabled ? "Activo" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {u.ultimoAcceso
                        ? new Date(u.ultimoAcceso).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Nunca"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <CambiarPassword usuarioId={u.id} onError={setAviso} />
                        <button
                          onClick={() => intentar(() => eliminarUsuario(u.id))}
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-rose-50 hover:text-rose-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Siempre debe quedar al menos un administrador activo, y nadie puede
        quitarse a sí mismo el rol ni desactivar su propia cuenta: sin eso el
        sistema se quedaría sin quien lo administre.
      </p>
    </>
  );
}

function CambiarPassword({
  usuarioId,
  onError,
}: {
  usuarioId: string;
  onError: (mensaje: string | null) => void;
}) {
  const { cambiarPasswordUsuario } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      onError(null);
      await cambiarPasswordUsuario(usuarioId, password);
      setPassword("");
      setAbierto(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
      >
        Contraseña
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mínimo 12 caracteres"
        className="w-44 rounded-md border border-line bg-white px-2 py-1 text-xs outline-none focus:border-amber"
      />
      <button
        onClick={guardar}
        disabled={guardando || password.length < 12}
        className="rounded-md bg-amber px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {guardando ? "…" : "OK"}
      </button>
      <button
        onClick={() => {
          setAbierto(false);
          setPassword("");
        }}
        className="rounded-md border border-line px-2 py-1 text-xs"
      >
        ×
      </button>
    </div>
  );
}

function FormularioUsuario({
  onGuardar,
}: {
  onGuardar: (datos: NuevoUsuario) => Promise<void>;
}) {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    role: "dispatcher" as RolUsuario,
    firstName: "",
    lastName: "",
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as typeof form);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        ...(form.firstName.trim() ? { firstName: form.firstName.trim() } : {}),
        ...(form.lastName.trim() ? { lastName: form.lastName.trim() } : {}),
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
      <CampoUsuario label="Correo">
        <input
          type="email"
          className={campoUsuario}
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
        />
      </CampoUsuario>
      <CampoUsuario label="Usuario">
        <input
          className={campoUsuario}
          value={form.username}
          onChange={(e) => set("username")(e.target.value)}
        />
      </CampoUsuario>
      <CampoUsuario label="Rol">
        <select
          className={campoUsuario}
          value={form.role}
          onChange={(e) => set("role")(e.target.value)}
        >
          {ROLES_USUARIO.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </CampoUsuario>
      <CampoUsuario label="Nombre">
        <input
          className={campoUsuario}
          value={form.firstName}
          onChange={(e) => set("firstName")(e.target.value)}
        />
      </CampoUsuario>
      <CampoUsuario label="Apellido">
        <input
          className={campoUsuario}
          value={form.lastName}
          onChange={(e) => set("lastName")(e.target.value)}
        />
      </CampoUsuario>
      <CampoUsuario label="Contraseña (mín. 12, con mayúscula, dígito y símbolo)">
        <input
          type="password"
          className={campoUsuario}
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
        />
      </CampoUsuario>

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}

function CampoUsuario({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Qué puede hacer cada rol. La matriz la sirve el backend a partir de los
 * mismos `@Roles(...)` que aplica `RolesGuard`, así que no puede quedar
 * desfasada de lo que el sistema realmente permite.
 */
function PanelPermisos() {
  const { modo, permisosPorRol } = useStore();
  const [permisos, setPermisos] = useState<Record<string, string[]>>({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    permisosPorRol()
      .then((p) => {
        if (vigente) setPermisos(p);
      })
      .catch(() => {
        if (vigente) setPermisos({});
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [permisosPorRol]);

  if (modo === "demo") {
    return (
      <Card>
        <Empty>
          Los permisos los define el backend; el modo demostración corre sin él.
        </Empty>
      </Card>
    );
  }

  if (cargando) {
    return (
      <Card>
        <Empty>Cargando permisos…</Empty>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES_USUARIO.map((rol) => (
          <Card key={rol.value} className="p-4">
            <p className="font-semibold">{rol.label}</p>
            <p className="mb-2 font-mono text-xs text-muted">{rol.value}</p>
            <ul className="space-y-1 text-sm">
              {(permisos[rol.value] ?? []).map((permiso) => (
                <li key={permiso} className="text-muted">
                  · {permiso}
                </li>
              ))}
              {(permisos[rol.value] ?? []).length === 0 ? (
                <li className="text-muted">Sin permisos asignados.</li>
              ) : null}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted">
        Los permisos son por rol, no por usuario: para cambiar lo que alguien
        puede hacer, se le cambia el rol en la pestaña «Usuarios».
      </p>
    </>
  );
}
