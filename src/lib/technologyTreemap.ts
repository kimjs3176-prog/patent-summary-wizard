import { hierarchy, treemap, treemapBinary } from "d3";
import { TECHNOLOGY_FIELDS, type TechnologyStats } from "../../supabase/functions/_shared/technologyFields";

export const TECHNOLOGY_TILE_CLASSES = Object.fromEntries(
  TECHNOLOGY_FIELDS.map(field => [field.id, `technology-tile-${field.tone}`]),
) as Record<typeof TECHNOLOGY_FIELDS[number]["id"], string>;

export function visibleTechnologyFields(fields: TechnologyStats["fields"]) {
  return fields.filter(field => field.count >= 10).sort((a, b) => b.count - a.count);
}

// Counts remain untouched: compare proportional areas within each rotating group.
export function groupTechnologyFields(fields: TechnologyStats["fields"], limit = 6) {
  const sorted = [...fields].sort((a, b) => b.count - a.count);
  const groups: TechnologyStats["fields"][] = [];
  for (const field of sorted) {
    const group = groups.at(-1);
    if (!group || group.length >= limit || (field.count === 0 && group[0].count > 0) ||
      (field.count > 0 && group[0].count / field.count > 4)) groups.push([field]);
    else group.push(field);
  }
  return groups;
}

export function layoutTechnologyFields(fields: TechnologyStats["fields"], width: number, height: number) {
  const children = fields.filter(field => field.count > 0).map(field => ({ ...field, ...TECHNOLOGY_FIELDS.find(def => def.id === field.id) }));
  const root = hierarchy({ children } as { children?: typeof children; count?: number }).sum(node => node.count ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return treemap<typeof root.data>().tile(treemapBinary).size([width, height]).paddingInner(4).round(true)(root).leaves().map(node => ({ ...node.data as typeof children[number], x: node.x0, y: node.y0, width: node.x1 - node.x0, height: node.y1 - node.y0 }));
}