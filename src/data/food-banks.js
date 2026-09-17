/**
 * Food bank dataset.
 *
 * Coordinates are pre-resolved (Nominatim, build time) so the app never
 * geocodes a static list at runtime: 13 addresses used to mean 13 sequential
 * network round trips on every "food bank" command, which both rate-limited
 * the public geocoder and made the feature take ~15s to paint.
 *
 * `hours` is structured so "open now" can be computed; `hoursText` keeps the
 * human-readable source string for display.
 *
 * Day numbers follow Date#getDay(): 0 = Sunday .. 6 = Saturday.
 * `weeks` (optional) restricts a slot to the Nth occurrence of that weekday
 * in the month, e.g. "2nd and 3rd Saturday".
 */

export const HOURS_TIMEZONE = "America/New_York";

export const FOOD_BANKS = [
  {
    id: "shared-harvest",
    name: "Shared Harvest Foodbank",
    address: "5901 Dixie Highway, Fairfield, OH 45014-4207",
    phone: "800-352-3663",
    lat: 39.32908,
    lon: -84.515461,
    kind: "regional",
    hoursText: "Regional food bank contact.",
    hours: null
  },
  {
    id: "freestore",
    name: "Freestore Foodbank",
    address: "112 E Liberty St, Cincinnati, OH 45202",
    phone: "513-482-4500",
    lat: 39.113165,
    lon: -84.513502,
    kind: "regional",
    hoursText: "Not listed in source.",
    hours: null
  },
  {
    id: "mid-ohio",
    name: "Mid-Ohio Food Collective",
    address: "3960 Brookham Dr, Grove City, OH 43123",
    phone: "614-274-7770",
    lat: 39.882397,
    lon: -83.049787,
    kind: "regional",
    hoursText: "Not listed in source.",
    hours: null
  },
  {
    id: "the-foodbank-dayton",
    name: "The Foodbank, Inc.",
    address: "5650 Webster St, Dayton, OH 45414",
    phone: "937-461-5300",
    lat: 39.826,
    lon: -84.179697,
    kind: "regional",
    hoursText: "Not listed in source.",
    hours: null
  },
  {
    id: "fairfield-pantry",
    name: "Fairfield Food Pantry",
    address: "78 Donald Drive, Fairfield, OH 45014",
    phone: "513-829-9047",
    lat: 39.343809,
    lon: -84.535636,
    kind: "pantry",
    hoursText: "Mon noon-3 pm; Wed noon-3 pm; Fri noon-3 pm.",
    hours: [
      { days: [1, 3, 5], open: "12:00", close: "15:00" }
    ]
  },
  {
    id: "hamilton-dream-center",
    name: "Hamilton Dream Center",
    address: "725 Campbell Ave, Hamilton, OH 45011",
    phone: "513-893-2800",
    lat: 39.398835,
    lon: -84.553438,
    kind: "pantry",
    hoursText: "Fri 3 pm-5 pm; 2nd and 3rd Sat 10 am-2 pm.",
    hours: [
      { days: [5], open: "15:00", close: "17:00" },
      { days: [6], open: "10:00", close: "14:00", weeks: [2, 3] }
    ]
  },
  {
    id: "lighthouse",
    name: "Lighthouse Food Pantry",
    address: "626 Ridgelawn Ave, Hamilton, OH 45013",
    phone: "513-867-9463",
    lat: 39.411528,
    lon: -84.566692,
    kind: "pantry",
    hoursText: "Tue 5 pm-7 pm; Sat 9:30 am-12:30 pm.",
    hours: [
      { days: [2], open: "17:00", close: "19:00" },
      { days: [6], open: "09:30", close: "12:30" }
    ]
  },
  {
    id: "faith-community-umc",
    name: "Faith Community United Methodist",
    address: "8230 Cox Rd, West Chester, OH 45069",
    phone: "513-777-9533",
    lat: 39.341955,
    lon: -84.365864,
    kind: "pantry",
    hoursText: "Tue 1 pm-2:30 pm and 6:30 pm-8 pm; Sat 10 am-11:30 am.",
    hours: [
      { days: [2], open: "13:00", close: "14:30" },
      { days: [2], open: "18:30", close: "20:00" },
      { days: [6], open: "10:00", close: "11:30" }
    ]
  },
  {
    id: "lebanon-pantry",
    name: "Lebanon Food Pantry",
    address: "190 New Street, Lebanon, OH 45036",
    phone: "513-932-3617",
    lat: 39.438524,
    lon: -84.205347,
    kind: "pantry",
    hoursText: "Mon/Wed/Fri 9 am-noon; Wed 6 pm-8 pm.",
    hours: [
      { days: [1, 3, 5], open: "09:00", close: "12:00" },
      { days: [3], open: "18:00", close: "20:00" }
    ]
  },
  {
    id: "mason-pantry",
    name: "Mason Food Pantry",
    address: "406 Fourth Avenue, Mason, OH 45040",
    phone: "513-754-0333",
    lat: 39.357583,
    lon: -84.316837,
    kind: "pantry",
    hoursText: "Mon 6:30 pm-7:30 pm; Wed 9:30 am-11 am; Sat 9:30 am-11 am.",
    hours: [
      { days: [1], open: "18:30", close: "19:30" },
      { days: [3], open: "09:30", close: "11:00" },
      { days: [6], open: "09:30", close: "11:00" }
    ]
  },
  {
    id: "amelia-umc",
    name: "Amelia United Methodist Church",
    address: "19 E Main St, Amelia, OH 45102",
    phone: "513-753-6770",
    lat: 39.027454,
    lon: -84.215785,
    kind: "pantry",
    hoursText: "Mon and Wed 11 am-1 pm.",
    hours: [
      { days: [1, 3], open: "11:00", close: "13:00" }
    ]
  },
  {
    id: "inter-parish-ministry",
    name: "Inter Parish Ministry",
    address: "4623 Aicholtz Rd, Cincinnati, OH 45244",
    phone: "513-561-3932",
    lat: 39.104069,
    lon: -84.295103,
    kind: "pantry",
    hoursText: "Mon/Tue/Thu/Fri 10 am-noon.",
    hours: [
      { days: [1, 2, 4, 5], open: "10:00", close: "12:00" }
    ]
  },
  {
    id: "sem",
    name: "SEM",
    address: "2020 Beechmont Ave, Cincinnati, OH 45230",
    phone: "513-231-1412",
    lat: 39.092055,
    lon: -84.386846,
    kind: "appointment",
    hoursText: "By appointment.",
    hours: []
  }
];

/** Default view for the region the dataset covers. */
export const REGION_VIEW = { lat: 39.4, lon: -84.3, zoom: 9 };
