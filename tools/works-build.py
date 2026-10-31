# -*- coding: utf-8 -*-
"""
作品墙构建工具：扫描 assets/works/ 里的原始大图（抖音图集导出的 jpeg），
生成缩略图到 assets/works-thumb/，并生成 js/works-list.js 清单。

用法：python tools/works-build.py

· 原图保留在 assets/works/（文件名含中文/空格/#，仅供灯箱点开看大图）。
· 缩略图用规整短名 w01.jpg … wNN.jpg（纯 ASCII，作品墙快速加载用），
  宽度统一缩到 --max-w（默认 480px，覆盖 2x 屏）。
· 清单记录：缩略图文件名 f、原图文件名 full、原始宽高 w/h、标题 title。
"""
import os
import re
import json
import glob
import argparse

from PIL import Image
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'works')
THUMB = os.path.join(ROOT, 'assets', 'works-thumb')
JS_OUT = os.path.join(ROOT, 'js', 'works-list.js')
TITLE_MAP = os.path.join(ROOT, 'tools', 'works-titles.json')
EXTS = ('.jpeg', '.jpg', '.png', '.webp', '.avif')


def load_titles():
    """读重命名时导出的「新文件名 -> 原标题」映射，缺文件返回空表。"""
    try:
        with open(TITLE_MAP, 'r', encoding='utf-8') as fp:
            return json.load(fp)
    except (OSError, ValueError):
        return {}


def title_of(name):
    """从「日期-图集-YUNA ゆうな-标题#标签_序号.jpeg」里取标题部分。"""
    stem = os.path.splitext(name)[0]
    # 去掉末尾的 _序号
    stem = re.sub(r'_\d+$', '', stem)
    # 去掉开头的 日期-图集- 部分
    parts = stem.split('-')
    # 找 YUNA 之后的标题段
    out = []
    seen_yuna = False
    for p in parts:
        if 'YUNA' in p:
            seen_yuna = True
            continue
        if seen_yuna:
            out.append(p)
    title = '-'.join(out).strip() if out else stem
    # 去掉 #标签 部分
    title = re.split(r'[#＃]', title)[0].strip()
    return title or '作品'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--max-w', type=int, default=480, help='缩略图最大宽度(px)')
    ap.add_argument('--quality', type=int, default=80, help='JPEG 质量')
    args = ap.parse_args()

    files = []
    for ext in EXTS:
        files += glob.glob(os.path.join(SRC, '*' + ext))
    files = sorted(set(files))
    if not files:
        raise SystemExit('找不到原图目录：' + SRC)

    os.makedirs(THUMB, exist_ok=True)
    titles = load_titles()

    out = []
    for i, path in enumerate(files):
        name = os.path.basename(path)
        stem = os.path.splitext(name)[0]
        thumb_name = 'w%02d.jpg' % (i + 1)
        thumb_path = os.path.join(THUMB, thumb_name)

        with Image.open(path) as im:
            im = im.convert('RGB')
            w, h = im.size
            if w > args.max_w:
                nh = round(h * args.max_w / w)
                im = im.resize((args.max_w, nh), Image.LANCZOS)
            im.save(thumb_path, 'JPEG', quality=args.quality)

        out.append({
            'f': thumb_name,                 # 缩略图文件名（作品墙用）
            'full': quote(name),             # 原图文件名（灯箱大图，URL 编码）
            'w': w, 'h': h,                  # 原始尺寸
            't': titles.get(name) or title_of(name),  # 标题：优先映射，其次从文件名提取
        })

    with open(JS_OUT, 'w', encoding='utf-8') as fp:
        fp.write('/* 由 tools/works-build.py 生成，不要手改。\n')
        fp.write('   字段：f=缩略图文件名，full=原图文件名(URL编码)，w/h=原始尺寸，t=标题 */\n')
        fp.write('window.NCJ_WORKS = ')
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
        fp.write(';\n')

    print('完成：%d 张缩略图 + 清单写入 %s' % (len(out), JS_OUT))
    # 清理旧的、多出来的缩略图
    existing = set(os.listdir(THUMB))
    keep = set(o['f'] for o in out)
    for extra in existing - keep:
        os.remove(os.path.join(THUMB, extra))
        print('  清理多余缩略图:', extra)


if __name__ == '__main__':
    main()
