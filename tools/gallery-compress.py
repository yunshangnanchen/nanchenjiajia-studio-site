# -*- coding: utf-8 -*-
"""
画廊图片压缩工具：把 assets/gallery/ 里的图统一压成适合 Web 展示的 AVIF。

用法：python tools/gallery-compress.py [--max-w 1600] [--quality 55] [--dry-run]

· 原图多是 2500~6000px 宽、1~30MB 的 PNG/AVIF，但画廊三排横条只显示几百像素，
  所以统一缩到 --max-w（默认 1600px，覆盖 2x 屏），转 AVIF，体积能降一个数量级。
· 输出直接覆盖原文件（扩展名统一改成 .avif），PNG 会删除。
· 纯 ASCII/日文文件名不影响，URL 编码由 gallery-list.py 负责。
· 只处理需要压缩的：已小于目标尺寸且已是 avif 的跳过（避免重复压）。
"""
import os
import sys
import glob
import argparse

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GALLERY = os.path.join(ROOT, 'assets', 'gallery')
EXTS = ('.png', '.avif', '.jpg', '.jpeg', '.webp')


def compress_one(path, max_w, quality, dry_run):
    name = os.path.basename(path)
    stem, ext = os.path.splitext(name)
    out_path = os.path.join(GALLERY, stem + '.avif')

    with Image.open(path) as im:
        im = im.convert('RGB')          # 去掉 alpha，画廊是黑底不需要透明
        w, h = im.size
        if w > max_w:
            nh = round(h * max_w / w)
            im = im.resize((max_w, nh), Image.LANCZOS)
            resized = True
        else:
            resized = False

        # 已经是 avif 且没缩放、且体积已经很小 → 跳过（避免重复压）
        before = os.path.getsize(path)
        if not dry_run and ext.lower() == '.avif' and not resized and before < 350 * 1024:
            return 'skip', name, before, before

        if dry_run:
            return 'plan', name, before, None

        im.save(out_path, 'AVIF', quality=quality, method=4)

    after = os.path.getsize(out_path)
    if ext.lower() != '.avif' and os.path.abspath(path) != os.path.abspath(out_path):
        os.remove(path)                  # 删掉原 PNG/JPG
    return 'ok', name, before, after


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-w', type=int, default=1600, help='目标最大宽度(px)')
    ap.add_argument('--quality', type=int, default=55, help='AVIF 质量 0-100')
    ap.add_argument('--dry-run', action='store_true', help='只统计不写文件')
    args = ap.parse_args()

    files = []
    for ext in EXTS:
        files += glob.glob(os.path.join(GALLERY, '*' + ext))
    files = sorted(set(files))

    if not files:
        sys.exit('画廊目录没有图片：' + GALLERY)

    total_before = total_after = 0
    skipped = 0
    for path in files:
        try:
            status, name, before, after = compress_one(path, args.max_w, args.quality, args.dry_run)
        except Exception as e:
            print('  出错:', os.path.basename(path), e)
            continue

        if status == 'skip':
            skipped += 1
            continue
        total_before += before
        if after is not None:
            total_after += after
        if args.dry_run:
            print('  [计划]', name, '%.0fKB -> 压缩' % (before / 1024))
        else:
            print('  [完成]', name, '%.0fKB -> %.0fKB (%.0f%%)' % (
                before / 1024, after / 1024, after / before * 100))

    print('\n共 %d 张，跳过 %d 张（已够小）' % (len(files), skipped))
    if not args.dry_run:
        print('总大小: %.1fMB -> %.1fMB，省 %.1fMB' % (
            total_before / 1024 / 1024, total_after / 1024 / 1024,
            (total_before - total_after) / 1024 / 1024))
    else:
        print('(dry-run，未写入)')


if __name__ == '__main__':
    main()
