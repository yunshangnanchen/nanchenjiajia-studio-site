# -*- coding: utf-8 -*-
"""
画廊图片文件名规范化工具。

把 assets/gallery/ 里含空格、全角引号、全角冒号等对 URL 不友好的字符
替换为安全字符，规避 Netlify / GitHub Pages 部署时的文件名问题。

替换规则：
  - 空格           -> 下划线 _
  - 全角引号 ＂＂   -> 去掉（用半角 ' 或直接删）
  - 全角冒号 ：     -> 半角 -（或去掉）
  - 全角括号（）   -> 去掉
  - ™ ® 等特殊符号 -> 去掉
  - ◆              -> 去掉
  - 中文书名号 『』 -> 去掉

标题信息不受影响：gallery-list.py 会重新扫描，作品名单独存在清单的 t 字段里。

用法：python tools/gallery-rename.py [--dry-run]
"""
import os
import re
import glob
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GALLERY = os.path.join(ROOT, 'assets', 'gallery')
EXTS = ('.avif', '.png', '.jpg', '.jpeg', '.webp')

# 逐字符替换表（按顺序应用）
REPLACEMENTS = [
    (' ', '_'),          # 空格 -> 下划线
    ('\uff02', ''),      # ＂ 全角引号
    ('\u201c', ''),      # "
    ('\u201d', ''),      # "
    ('\u201e', ''),      # „
    ('\uff1a', '-'),     # ：
    ('\uff08', ''),      # （
    ('\uff09', ''),      # ）
    ('\u300e', ''),      # 『
    ('\u300f', ''),      # 』
    ('\u300c', ''),      # 「
    ('\u300d', ''),      # 」
    ('\u2122', ''),      # ™
    ('\u00ae', ''),      # ®
    ('\u25c6', '-'),     # ◆ -> -（避免单独成空，标题另有 t 字段保留）
    ('\uff06', 'and'),   # ＆ -> and
    ('[', '_'),          # [  (出现在文件名里也可能被 shell 误解)
    (']', '_'),          # ]
    ('\u2018', ''),      # '
    ('\u2019', ''),      # '
]


def safe_name(name):
    for a, b in REPLACEMENTS:
        name = name.replace(a, b)
    # 清理连续下划线 / 连字符
    name = re.sub(r'_+', '_', name)
    name = re.sub(r'-+', '-', name)
    # 去掉结尾的 - 或 _（保留扩展名前的主体干净）
    stem, ext = os.path.splitext(name)
    stem = stem.strip('-_')
    return stem + ext


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='只打印不改名')
    args = ap.parse_args()

    files = []
    for ext in EXTS:
        files += glob.glob(os.path.join(GALLERY, '*' + ext))
    files = sorted(set(files))

    renamed = 0
    for path in files:
        name = os.path.basename(path)
        new_name = safe_name(name)
        if new_name == name:
            continue
        new_path = os.path.join(GALLERY, new_name)
        if os.path.exists(new_path):
            print('  !! 目标已存在，跳过:', name)
            continue
        if args.dry_run:
            print('  将重命名:', name, '->', new_name)
        else:
            os.rename(path, new_path)
            print('  重命名:', name, '->', new_name)
        renamed += 1

    print('\n共重命名 %d 个文件%s' % (renamed, '（dry-run，未实际改名）' if args.dry_run else ''))


if __name__ == '__main__':
    main()
