#!/usr/bin/env python3
"""Launch an isolated GNOME AOD preview with disposable state."""
from pathlib import Path
import argparse,json,os,shutil,subprocess
parser=argparse.ArgumentParser();parser.add_argument("--interactive",action="store_true");parser.add_argument("--style",choices=["live","lockscreen"]);args=parser.parse_args()
source=Path(__file__).resolve().parents[1]
root=Path(os.environ.get('AOD_PREVIEW_ROOT',str(Path.home()/('.private/State/zenos-aod/mdk' if args.interactive else '.private/State/zenos-aod/preview'))))
(root/'result.json').unlink(missing_ok=True)
for name in ['home','data/gnome-shell/extensions','system/gnome-shell/modes','config','cache','state','runtime']:(root/name).mkdir(parents=True,exist_ok=True)
(root/'runtime').chmod(0o700)
uuid='aod@neg-zero.com';dest=root/'data/gnome-shell/extensions'/uuid
if dest.exists():shutil.rmtree(dest)
shutil.copytree(source,dest,ignore=shutil.ignore_patterns('.git','tests','tools'))
compiler=next(Path('/nix/store').glob('*-glib-*-dev/bin/glib-compile-schemas'))
subprocess.run([str(compiler),str(dest/'schemas')],check=True)
mode='zenos-aod-preview';meta=json.loads((dest/'metadata.json').read_text());meta['session-modes']=['user','unlock-dialog',mode];(dest/'metadata.json').write_text(json.dumps(meta))
setup=root/'data/gnome-shell/extensions/aod-test@zenos.test';setup.mkdir(exist_ok=True)
(setup/'metadata.json').write_text(json.dumps({'uuid':setup.name,'name':'AOD test','description':'Isolated native test','shell-version':['50'],'session-modes':['user','unlock-dialog',mode]}))
shutil.copyfile(source/'tools/preview-setup.js',setup/'extension.js')
for name in ['native-test.js','test-window.js']:shutil.copyfile(source/'tools'/name,setup/name)
(root/f'system/gnome-shell/modes/{mode}.json').write_text(json.dumps({'parentMode':'user','isPrimary':True,'enabledExtensions':[uuid,setup.name],'components':[],'showWelcomeDialog':False}))
real_runtime=os.environ.get('XDG_RUNTIME_DIR','/run/user/1000')
gjs=str(next(Path('/nix/store').glob('*-gjs-1.88.1/bin/gjs')))
types=':'.join(str(p) for p in Path('/nix/store').glob('*-gtk4-4.22.4/lib/girepository-1.0'))
env=dict(os.environ,AOD_PREVIEW_MODE=args.style or '',AOD_GJS=gjs,GI_TYPELIB_PATH=types+':'+os.environ.get('GI_TYPELIB_PATH',''),PIPEWIRE_RUNTIME_DIR=real_runtime,WAYLAND_DISPLAY=str(Path(real_runtime)/os.environ.get('WAYLAND_DISPLAY','wayland-0')),AOD_INTERACTIVE='1' if args.interactive else '0',HOME=str(root/'home'),XDG_DATA_HOME=str(root/'data'),XDG_CONFIG_HOME=str(root/'config'),XDG_CACHE_HOME=str(root/'cache'),XDG_STATE_HOME=str(root/'state'),XDG_RUNTIME_DIR=str(root/'runtime'),XDG_DATA_DIRS=str(root/'system')+':'+os.environ.get('XDG_DATA_DIRS','/run/current-system/sw/share'),GSETTINGS_BACKEND='dconf',AOD_PREVIEW_ROOT=str(root),GTK_A11Y='none',NO_AT_BRIDGE='1',GIO_USE_VFS='local')
with (root/'shell.log').open('w') as log:
 p=subprocess.Popen(['dbus-run-session','--','gnome-shell',*(['--devkit'] if args.interactive else ['--headless','--virtual-monitor=1920x1080']),f'--mode={mode}'],env=env,stdout=log,stderr=log,start_new_session=True)
(root/'launcher.json').write_text(json.dumps({'pid':p.pid}));print(root,p.pid)
