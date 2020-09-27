# Parse the event file containing activity start/end times and infection events.
# - Link events are not needed -- people float between activities.
# - Time between actend and actstart is travel time for the trip
#
# Produces 3js.json, format:
# [
#    { id: string,                   # person_id
#      time: [number...],            # array of trip time points, in seconds
#      points: [ (x,y)...],          # array of (x,y) coordinates for time points
#      disease_time: [number...],    # array of disease event time points
#      disease: [code...]            # array of disease status codes, see below
#    }
# ]

try:
    import ndjson
    import sys
    import matsim
    from dfply import *
except:
    print("OOPS! Error importing required libraries.")
    print('try "pip install matsim-tools ndjson dfply"')

# outfile hard-coded for now
outfile = "drt-vehicles.json"

print("reading network", sys.argv[1])
network = matsim.read_network(sys.argv[1])

# Build link x/y lookup
nodes = network.nodes >> mutate(to_node=X.node_id, from_node=X.node_id)
links = (
    network.links
    >> inner_join(nodes, by="from_node")
    >> select(X.link_id, X.from_node, X.to_node_x, X.x, X.y)
    >> mutate(x0=X.x, y0=X.y, to_node=X.to_node_x)
    >> inner_join(nodes, by="to_node")
    >> select(X.link_id, X.x0, X.y0, X.x_y, X.y_y)
)

link_coords = {}
for link in links.values:
    link_coords[link[0]] = (
        float(link[1]),
        float(link[2]),
        float(link[3]),
        float(link[4]),
    )

print("reading events", sys.argv[2])
events = matsim.event_reader(
    sys.argv[2],
    types="entered link,left link,vehicle enters traffic,vehicle leaves traffic,PersonEntersVehicle,PersonLeavesVehicle",
)

# lookups by person's health status, coords, and timepoints
agents = {}

act_ends = {}
cur_location = {}

for event in events:
    # only interested in DRT vehicle events
    if not event["vehicle"]:
        continue

    if not event["vehicle"].startswith("drt"):
        continue

    person_id = event["vehicle"]
    time = int(event["time"])

    # create a hollow person
    if person_id not in agents:
        agents[person_id] = {"id": person_id, "trips": [], "passengers": 0}

    person = agents[person_id]

    if "link" in event:
        link = link_coords[event["link"]]

    # Pickup/Dropoff
    if event["type"] == "PersonEntersVehicle":
        person["passengers"] += 1

    elif event["type"] == "PersonLeavesVehicle":
        person["passengers"] -= 1
        if person["passengers"] < 0:
            person["passengers"] = 0
            print("whoops, negative passengers", person_id)

    # enters traffic: guess it's at midpoint of link
    elif event["type"] == "vehicle enters traffic":
        midpoint = [0.5 * (link[0] + link[2]), 0.5 * (link[1] + link[3])]
        person["trips"].append((time, midpoint, person["passengers"]))

    elif event["type"] == "entered link":
        # start-node
        start = [link[0], link[1]]
        # don't dupe previous node
        prevTime, prevLocation, passengers = person["trips"][-1]

        if (
            time != prevTime
            or start[0] != prevLocation[0]
            or start[1] != prevLocation[1]
        ):
            person["trips"].append((time, start, person["passengers"]))

    elif event["type"] == "left link":
        # end-node
        person["trips"].append((time, [link[2], link[3]], person["passengers"]))

    elif event["type"] == "vehicle leaves traffic":
        midpoint = [0.5 * (link[0] + link[2]), 0.5 * (link[1] + link[3])]
        person["trips"].append((time, midpoint, person["passengers"]))


# get everything sorted
for person in agents.values():
    # print(person, "\n")
    person["trips"] = sorted(person["trips"], key=lambda k: k[0])
    person["timestamps"] = [t[0] for t in person["trips"]]
    person["path"] = [t[1] for t in person["trips"]]
    person["passengers"] = [t[2] for t in person["trips"]]
    person["vendor"] = 0
    del person["trips"]

# write it out
with open(outfile, "w") as f:
    writer = ndjson.writer(f, separators=(",", ":"))
    for agent in agents.values():
        writer.writerow(agent)

print(len(agents), "agents written.")