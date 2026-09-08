// Replace names in values, never in evidence IDs or field names.
export function redactStudentNames(value, students) {
  const aliases = new Map();
  for (const student of students) {
    const name = String(student.name || '').trim();
    if (!name) continue;
    const label = Number.isInteger(Number(student.number)) ? `학생-${Number(student.number)}` : '학생';
    aliases.set(name, aliases.has(name) && aliases.get(name) !== label ? '동명이인 학생' : label);
  }
  const names = [...aliases.keys()].sort((a,b)=>b.length-a.length);
  const pattern = names.length ? new RegExp(names.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g') : null;
  const visit = (item, key='') => {
    if (['source_refs','response_id'].includes(key)) return item;
    if (typeof item === 'string') return pattern ? item.replace(pattern, name=>aliases.get(name)) : item;
    if (Array.isArray(item)) return item.map(entry=>visit(entry));
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key,entry])=>[key,visit(entry,key)]));
    return item;
  };
  return visit(value);
}
