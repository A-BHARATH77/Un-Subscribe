import glob
import re

for file in glob.glob('src/components/*.tsx'):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix multiline style values (single quotes containing newlines)
    def fix_styles(m):
        style_content = m.group(1)
        def fix_quote(qm):
            return qm.group(0).replace('\n', ' ').replace('\r', ' ')
        style_content = re.sub(r"'[^']*'", fix_quote, style_content)
        return 'style={{' + style_content + '}}'
        
    content = re.sub(r'style={{(.*?)}}', fix_styles, content, flags=re.DOTALL)

    # Fix scripts with content
    def fix_script(m):
        attrs = m.group(1)
        script_content = m.group(2)
        if not script_content.strip():
            return m.group(0)
        script_content = script_content.replace('`', '\\`').replace('$', '\\$')
        return f'<script{attrs} dangerouslySetInnerHTML={{{{ __html: `{script_content}` }}}}></script>'

    content = re.sub(r'<script([^>]*)>(.*?)</script>', fix_script, content, flags=re.DOTALL)

    # Fix any remaining style="width: 100%" that was missed (if any)
    # The previous script already did style to object, so we are fine.

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
