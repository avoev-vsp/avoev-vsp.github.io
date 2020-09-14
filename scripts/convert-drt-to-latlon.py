try:
    import ndjson
    import sys
    import matsim
    import json
    from pyproj import Transformer
    from dfply import *

except:
    print("OOPS! Error importing required libraries.")
    print('try "pip install matsim-tools pyproj ndjson dfply"')

# outfile hard-coded for now
outfile = "drt-latlon.json"
items = []


print("reading trips", sys.argv[1], "using", sys.argv[2])

transformer = Transformer.from_crs(sys.argv[2], "EPSG:4326")

with open(sys.argv[1]) as f:
    data = ndjson.load(f)

# convert coordinates
for row in data:
    # print(row)
    latlon = []
    for x, y in row["path"]:
        lat, lon = transformer.transform(x, y)
        answer = [round(lon, 5), round(lat, 5)]
        latlon.extend([answer])

    row["path"] = latlon
    items.append(row)

with open(outfile, "w") as f:
    json.dump(items, f, separators=(",", ":"))

print(len(items), "trips written.")
