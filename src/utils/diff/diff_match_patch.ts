export default class diff_match_patch {
  diff_main(a: string, b: string): [number, string][] {
    const diffs: [number, string][] = []
    if (a === b) {
      diffs.push([0, a])
    } else {
      if (a) diffs.push([-1, a])
      if (b) diffs.push([1, b])
    }
    return diffs
  }
  diff_cleanupSemantic(_: [number, string][]) {}
}