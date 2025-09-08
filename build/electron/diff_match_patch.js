
/*!
 * Diff Match and Patch
 * https://github.com/google/diff-match-patch
 */
function diff_match_patch() {}
diff_match_patch.prototype.DIFF_DELETE = -1;
diff_match_patch.prototype.DIFF_INSERT = 1;
diff_match_patch.prototype.DIFF_EQUAL = 0;

diff_match_patch.prototype.diff_main = function(text1, text2) {
  if (text1 === text2) return [[this.DIFF_EQUAL, text1]];
  if (!text1) return [[this.DIFF_INSERT, text2]];
  if (!text2) return [[this.DIFF_DELETE, text1]];
  return [[this.DIFF_DELETE, text1], [this.DIFF_INSERT, text2]];
};

diff_match_patch.prototype.diff_cleanupSemantic = function(diffs) {
  // Stub: no semantic cleanup in this lightweight version
};
