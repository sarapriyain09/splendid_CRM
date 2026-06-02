import re

path = '/home/sarapriyain/Projects/CRM/splendid_CRM/.env.local'
with open(path, 'r') as f:
    content = f.read()

content = re.sub(r'(TWILIO_ACCOUNT_SID=)[^\n]*', r'\1AC33bc9d547bfd15cb86a5cec4e0951a2b', content)
content = re.sub(r'(TWILIO_AUTH_TOKEN=)[^\n]*', r'\1f10a8e49fcce2c95f7e7504dea76e12a', content)

with open(path, 'w') as f:
    f.write(content)

print('Done. TWILIO lines:')
for line in content.splitlines():
    if 'TWILIO' in line:
        print(line)
