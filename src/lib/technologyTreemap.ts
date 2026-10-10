import { hierarchy, treemap, treemapBinary } from "d3";
import { TECHNOLOGY_FIELDS, type TechnologyStats } from "../../supabase/functions/_shared/technologyFields";

export function layoutTechnologyFields(fields: TechnologyStats["fields"], width: number, height: number) {
  const children = fields.filter(field => field.count > 0).map(field => ({ ...field, ...TECHNOLOGY_FIELDS.find(def => def.id === field.id) }));
  const root = hierarchy({ children } as { children?: typeof children; count?: number }).sum(node => node.count ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return treemap<typeof root.data>().tile(treemapBinary).size([width, height]).paddingInner(3).round(true)(root).leaves().map(node => ({ ...node.data as typeof children[number], x: node.x0, y: node.y0, width: node.x1 - node.x0, height: node.y1 - node.y0 }));
}