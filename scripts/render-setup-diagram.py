"""Generate the English README diagram without third-party dependencies."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent

def text(x, y, label, size=16, fill="#aab9ce", weight=400):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}">{escape(label)}</text>'

svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="850" viewBox="0 0 1280 850" role="img" aria-labelledby="title desc">',
       '<title id="title">Use Step Code in T3 through ACP</title>',
       '<desc id="desc">Install and authenticate Step Code, install the adapter, add a local ACP provider in T3, and start a task. Registry icons use the client’s supported Registry interface.</desc>',
       '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="none" stroke="#6f8caa" stroke-width="1.5"/></marker></defs>',
       '<rect width="1280" height="850" rx="24" fill="#101b2d"/>',
       '<g font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif">',
       text(48,49,'STEP CODE ACP',13,'#83c7ff',650),
       text(48,107,'Start in T3. Work with Step Code.',38,'#f3f7ff',700),
       text(48,145,'Install and sign in once. Then choose a project, select your model, and work in T3.',17),
       text(48,201,'ONE-TIME SETUP · ON THE MACHINE RUNNING YOUR T3 SERVER',12,'#8ba1bc',600)]
steps=[('Install Step Code CLI','Sign in with your Plan / API','Confirm that step can chat'),
       ('Install this ACP adapter','Download a release or clone','Keep the installation directory'),
       ('Add a provider in T3','Choose Local ACP command','Paste the full executable path'),
       ('Start working in T3','Open project · select Step Code','Choose a model · send a task')]
for i,(title,line1,line2) in enumerate(steps):
    x=48+i*301
    svg += [f'<rect x="{x}" y="222" width="281" height="175" rx="16" fill="#14243a" stroke="#2b3c53"/>',
            text(x+18,260,f'{i+1:02}',15,'#b4e1ff',650),text(x+18,305,title,19,'#f3f7ff',600),text(x+18,341,line1,15),text(x+18,367,line2,15)]
    if i<3:svg.append(f'<path d="M{x+284} 308h12" stroke="#6f8caa" stroke-width="1.6" marker-end="url(#arrow)"/>')
svg.append(text(48,449,'EVERYDAY USE · WHAT RUNS WHEN YOU SEND A TASK',12,'#8ba1bc',600))
for i,(title,label) in enumerate([('T3 Code','Projects & conversation'),('ACP adapter','The connector in this repo'),('Step Code CLI','The actual coding agent'),('Step service','Your own Plan / API')]):
    x=48+i*301
    svg += [f'<rect x="{x}" y="470" width="281" height="103" rx="14" fill="#102d36" stroke="#275461"/>',text(x+20,513,title,23,'#c1f1e8',600),text(x+20,544,label,15,'#9dc6c8')]
    if i<3:svg.append(f'<path d="M{x+284} 520h12" stroke="#6f8caa" stroke-width="1.6" marker-end="url(#arrow)"/>')
svg += [text(48,608,'Your account and API key stay with Step Code. T3 starts the adapter and Step Code as needed.',16),
        '<rect x="48" y="651" width="1184" height="123" rx="16" fill="#17283e" stroke="#354e6c"/>',
        text(70,683,'REGISTRY BRANDING',14,'#a9ccf4',650),
        text(70,717,'Icons belong to the client’s supported Registry integration.',20,'#e2edff',600),
        text(70,749,'Registry review is required. A manually added local command may show a generic ACP icon.',16),
        text(48,815,'Community adapter · No T3 frontend patches · See README for compatibility and Registry status',13,'#7f94ad'),'</g></svg>']
(ROOT/'assets/setup-flow.svg').write_text('\n'.join(svg)+'\n',encoding='utf-8')
print('Wrote assets/setup-flow.svg')
