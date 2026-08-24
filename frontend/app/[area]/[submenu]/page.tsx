import { notFound } from "next/navigation";
import { Card, Empty, PageTitle } from "@/components/ui";
import { AREAS_MENU } from "@/lib/menu";

/**
 * Cae aquí cualquier submenú que todavía no tiene módulo propio. Solo
 * resuelve rutas que de verdad están en el menú (`AREAS_MENU`); cualquier
 * otra combinación de segmentos da 404 en vez de un "Próximamente" falso.
 */
export default async function Proximamente({
  params,
}: {
  params: Promise<{ area: string; submenu: string }>;
}) {
  const { area, submenu } = await params;
  const href = `/${area}/${submenu}`;

  const areaMenu = AREAS_MENU.find((a) => a.slug === area);
  const item = areaMenu?.items.find((i) => i.href === href);
  if (!areaMenu || !item) notFound();

  return (
    <>
      <PageTitle title={item.titulo} subtitle={areaMenu.titulo} />
      <Card>
        <Empty>Este módulo está en construcción. Próximamente.</Empty>
      </Card>
    </>
  );
}
