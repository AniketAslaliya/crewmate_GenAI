from zenrows import ZenRowsClient

client = ZenRowsClient("4921bf05195b4c8e5cf378adf00137702ec5c95d")
url = "https://httpbin.io/anything"

response = client.get(url)

print(response.text)