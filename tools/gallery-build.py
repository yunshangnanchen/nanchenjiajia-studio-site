# -*- coding: utf-8 -*-
"""
把原始大图批量压成相册用的缩略图，并生成 gallery-list.js。

用法：python tools/gallery-build.py

· 原图 718MB / 206 张，直接进页面不可行：相册排高约 20vh，屏上最多 200px 高，
  所以统一按「高 460px」缩，横向不超过 760px（超宽横幅再压一次）。
· 输出 assets/gallery/gNNN.webp（纯 ASCII 文件名，避开中文/日文路径的编码问题）。
· 每张顺便算一个平均色，写进数据里当占位底色 —— 图还没解码时不会先闪一块黑。
"""
import os
import re
import sys
import json
import hashlib

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'SWAV ／ 初画集発売中-5130774')
OUT_DIR = os.path.join(ROOT, 'assets', 'gallery')
JS_OUT = os.path.join(ROOT, 'gallery-list.js')

H = 460            # 缩略图高度（2 倍屏下显示 200~230px 也够）
MAX_W = 780        # 超宽横幅的限制
Q = 78             # webp 质量
EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.bmp')


def sorted_files():
    names = [n for n in os.listdir(SRC) if os.path.splitext(n)[1].lower() in EXTS]
    # 用文件名哈希排序：固定顺序（每次构建结果一致），但同系列作品会被打散，
    # 相册里不会连着出现同一套图的 p0/p1/p2
    return sorted(names, key=lambda n: hashlib.md5(n.encode('utf-8')).hexdigest())


def avg_color(im):
    small = im.convert('RGB').resize((1, 1), Image.LANCZOS)
    r, g, b = small.getpixel((0, 0))
    return '#%02x%02x%02x' % (r, g, b)


def title_of(name):
    """从「100190232_p0-寄生の魔女.jpg」里取作品名，去掉站点 id 和分页号。"""
    stem = os.path.splitext(name)[0]
    stem = re.sub(r'^\d+_p\d+[-_ ]*', '', stem).strip()
    return stem or os.path.splitext(name)[0]


def main():
    if not os.path.isdir(SRC):
        sys.exit('找不到素材目录：' + SRC)
    os.makedirs(OUT_DIR, exist_ok=True)

    files = sorted_files()
    total = len(files)
    out = []
    skipped = []

    for i, name in enumerate(files, 1):
        dst = os.path.join(OUT_DIR, 'g%03d.webp' % i)
        try:
            im = Image.open(os.path.join(SRC, name))
            im.load()
        except Exception as e:                                   # 坏图直接跳过，不中断整批
            skipped.append((name, str(e)))
            continue

        # 透明底压到黑底上（站点是纯黑背景，留白边会很脏）
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg = Image.new('RGB', im.size, (0, 0, 0))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert('RGB')

        color = avg_color(im)
        w, h = im.size
        nw, nh = int(round(w * H / h)), H
        if nw > MAX_W:
            nw, nh = MAX_W, int(round(h * MAX_W / w))

        # 直接覆盖（同名同尺寸，不需要先删）
        im.resize((nw, nh), Image.LANCZOS).save(dst, 'WEBP', quality=Q, method=4)
        out.append({'s': 'assets/gallery/g%03d.webp' % i, 'w': nw, 'h': nh,
                    'c': color, 't': title_of(name)})

        if i % 20 == 0:
            print('  %d/%d' % (i, total), flush=True)

    with open(JS_OUT, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/gallery-build.py 生成，不要手改。\n')
        f.write('   字段：s = 缩略图，w/h = 尺寸（撑住版面高度，图没加载也不跳），c = 平均色 */\n')
        f.write('window.GALLERY = ')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    size = sum(os.path.getsize(os.path.join(ROOT, o['s'])) for o in out) / 1048576.0
    print('\n完成：%d 张，共 %.1f MB，清单写入 %s' % (len(out), size, JS_OUT))
    if skipped:
        print('跳过 %d 张：' % len(skipped))
        for n, e in skipped[:10]:
            print('  -', n, e)


if __name__ == '__main__':
    main()
