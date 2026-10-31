# -*- coding: utf-8 -*-
"""
扫描相册「压缩」目录，生成 gallery-list.js。

原图目录已删除，现在相册直接以压缩版（avif/png）为唯一图源。

用法：python tools/gallery-list.py

· 只读图片头部拿宽高（不解码整张图），一两秒跑完。
· 宽高写进清单：图还没加载时，格子先按比例占好位置，滚动时不会跳。
· 路径做 URL 编码（目录名里有全角斜杠和空格）。
"""
import os
import re
import sys
import json
import hashlib
from urllib.parse import quote

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMP_NAME = 'assets/gallery'                     # 画廊图源目录（avif/png），URL 用正斜杠
COMP = os.path.join(ROOT, *COMP_NAME.split('/'))
JS_OUT = os.path.join(ROOT, 'gallery-list.js')
EXTS = ('.avif', '.png')                        # 压缩版可能的扩展名


def title_of(name):
    """从「100190232_p0-寄生の魔女.avif」里取作品名，去掉站点 id 和分页号。"""
    stem = os.path.splitext(name)[0]
    stem = re.sub(r'^\d+_p\d+[-_ ]*', '', stem).strip()
    return stem or os.path.splitext(name)[0]


def main():
    if not os.path.isdir(COMP):
        sys.exit('找不到压缩目录：' + COMP)

    # 压缩目录里的图片清单（作为相册的完整作品集）
    names = [n for n in os.listdir(COMP) if os.path.splitext(n)[1].lower() in EXTS]
    # 用文件名哈希排序：每次构建顺序一致，但同系列作品会被打散，
    # 相册里不会连着出现同一套图的 p0/p1/p2
    names.sort(key=lambda n: hashlib.md5(n.encode('utf-8')).hexdigest())

    out, skipped = [], []
    for name in names:
        rel = COMP_NAME + '/' + name
        path = os.path.join(COMP, name)
        try:
            with Image.open(path) as im:   # 惰性打开，只读头部
                w, h = im.size
        except Exception as e:
            skipped.append((name, str(e)))
            continue

        out.append({
            's': quote(rel, safe='/'),
            'w': w, 'h': h,
            't': title_of(name),
        })

    with open(JS_OUT, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/gallery-list.py 生成，不要手改。\n')
        f.write('   字段：s = 图片路径（压缩版 avif/png），w/h = 原始尺寸，t = 作品名 */\n')
        f.write('window.GALLERY = ')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    print('完成：%d 张，清单写入 %s' % (len(out), JS_OUT))
    if skipped:
        print('跳过 %d 张：' % len(skipped))
        for n, e in skipped[:10]:
            print('  -', n, e)


if __name__ == '__main__':
    main()
