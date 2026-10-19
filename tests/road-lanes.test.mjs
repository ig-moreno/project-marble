// Run with Node 24+: node --test tests/road-lanes.test.mjs
// Use Node's TypeScript transform without adding a runtime dependency.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) specifier += '.ts';
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context);
    return {
      format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
    };
  },
});

const { GridManager } = await import('../src/game/simulation/GridManager.ts');
const { createTile } = await import('../src/game/simulation/Tile.ts');
const { disconnectRoad } = await import('../src/game/simulation/road/RoadUtils.ts');
const { buildLaneGraph, sampleLane } = await import('../src/game/simulation/road/LaneGraph.ts');
const { findLaneRoute } = await import('../src/game/simulation/road/LanePathFinder.ts');
const { populateTestScenario, testRoutes, circularTestRoutes } = await import('../src/game/scenarios/TestScenario.ts');
const { movementsConflict } = await import('../src/game/simulation/vehicles/IntersectionReservations.ts');
const { TEST_SCENARIO_CONFIG } = await import('../src/config/game/testScenario.ts');
const { VehicleManager } = await import('../src/game/simulation/vehicles/VehicleManager.ts');
const { advanceLaneVehicle } = await import('../src/game/simulation/vehicles/LaneVehicleMovement.ts');
const { SimulationManager } = await import('../src/game/simulation/SimulationManager.ts');
const vectors = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const opposite = { north: 'south', east: 'west', south: 'north', west: 'east' };
const sides = Object.keys(vectors);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const samePoint = (a, b) => { near(a.x, b.x); near(a.y, b.y); };
function road(grid, x, y, connections) {
  const tile = createTile(x, y, 'road');
  for (const side of connections) tile.roadConnections[side] = true;
  grid.setTile(x, y, tile);
}

test('intersection conflicts distinguish crossing/merging from compatible opposite straight movements', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const lane = (entry, exit) => graph.lanes.get(`0,0:${entry}->${exit}`);
  assert.equal(movementsConflict(lane('west', 'east'), lane('north', 'south'), 1.8, 1.8), true);
  assert.equal(movementsConflict(lane('west', 'east'), lane('east', 'west'), 1.8, 1.8), false);
  assert.equal(movementsConflict(lane('west', 'east'), lane('south', 'east'), 1.8, 1.8), true);
  assert.equal(movementsConflict(lane('west', 'east'), lane('west', 'east'), 1.8, 1.8), false);
});

function simpleCross() {
  const grid = new GridManager(20, 20);
  for (let x = -4; x <= 4; x++) road(grid, x, 0, x === -4 ? ['east'] : x === 4 ? ['west'] : ['east', 'west']);
  for (let y = -4; y <= 4; y++) {
    if (y) road(grid, 0, y, y === -4 ? ['south'] : y === 4 ? ['north'] : ['north', 'south']);
  }
  road(grid, 0, 0, sides);
  return { grid, graph: buildLaneGraph(grid) };
}

test('compatible opposing straights reserve concurrently and release only after the rear clears', () => {
  const { grid, graph } = simpleCross();
  const manager = new VehicleManager(grid);
  const a = manager.createLaneVehicle(graph, findLaneRoute(graph, '-3,0:west', '3,0:west'));
  const b = manager.createLaneVehicle(graph, findLaneRoute(graph, '3,0:east', '-3,0:east'));
  let concurrent = false, heldAfterFrontExit = false;
  for (let i = 0; i < 600; i++) {
    manager.update(1 / 60);
    const reservations = manager.getIntersectionReservations();
    concurrent ||= reservations.length === 2;
    if (a.traveledDistance > 40 && a.rearRouteDistance - a.dimensions.rearOverhang < 40) {
      heldAfterFrontExit ||= reservations.some((item) => item.vehicleId === a.id);
    }
    assert.equal(bodiesOverlap(a, b), false);
  }
  assert.ok(concurrent);
  assert.ok(heldAfterFrontExit);
  assert.equal(manager.getIntersectionReservations().length, 0);
});

test('cars can follow the same reserved movement without waiting for the whole trajectory to empty', () => {
  const { grid, graph } = simpleCross();
  const manager = new VehicleManager(grid);
  const route = findLaneRoute(graph, '-3,0:west', '3,0:west');
  const leader = manager.createLaneVehicle(graph, route, 5, undefined, 32, true);
  const follower = manager.createLaneVehicle(graph, route, 5, undefined, 20);
  let sharedReservation = false;
  for (let tick = 0; tick < 240; tick++) {
    manager.update(1 / 60);
    const held = manager.getIntersectionReservations();
    sharedReservation ||= held.filter((reservation) => reservation.laneId === '0,0:west->east').length === 2;
    assert.equal(bodiesOverlap(leader, follower), false);
    const gap = leader.rearRouteDistance - leader.dimensions.rearOverhang
      - follower.traveledDistance - follower.dimensions.frontOverhang;
    assert.ok(gap >= VehicleManager.minimumGap - 1e-8);
  }
  assert.ok(sharedReservation, 'identical movements may be occupied by safely separated followers');
});

test('an occupied exit prevents entry; the waiting vehicle proceeds after the downstream car leaves', () => {
  const { grid, graph } = simpleCross();
  const manager = new VehicleManager(grid);
  const blocker = manager.createLaneVehicle(graph, findLaneRoute(graph, '1,0:west', '4,0:west'), 5, undefined, 5);
  blocker.speed = 0; blocker.cruiseSpeed = 0;
  const waiting = manager.createLaneVehicle(graph, findLaneRoute(graph, '-3,0:west', '3,0:west'));
  for (let i = 0; i < 900; i++) manager.update(1 / 60);
  assert.ok(waiting.frontAxle.x < -5, 'front bumper must stay outside the crossing');
  assert.ok(waiting.speed < 0.05);
  assert.equal(manager.getIntersectionReservations().some((item) => item.vehicleId === waiting.id), false);
  blocker.cruiseSpeed = 5;
  for (let i = 0; i < 900; i++) manager.update(1 / 60);
  assert.ok(waiting.frontAxle.x > 5);
});

test('exit storage is based on vehicle length, allowing a car where a longer vehicle must wait', () => {
  const { grid, graph } = simpleCross();
  for (const wheelbase of [2.6, 4.5]) {
    const manager = new VehicleManager(grid);
    const blocker = manager.createLaneVehicle(graph, findLaneRoute(graph, '1,0:west', '4,0:west'), 5, undefined, 10);
    blocker.speed = 0; blocker.cruiseSpeed = 0;
    const vehicle = manager.createLaneVehicle(graph, findLaneRoute(graph, '-3,0:west', '3,0:west'), 5,
      { wheelbase, frontOverhang: 0.7, rearOverhang: 0.7, width: 1.8, height: 1.3 }, 24);
    manager.update(1 / 60);
    assert.equal(manager.getIntersectionReservations().some((reservation) => reservation.vehicleId === vehicle.id), wheelbase === 2.6);
  }
});

test('moving exit traffic can provide braking-backed clearance, rechecked if it stops', () => {
  const { grid, graph } = simpleCross();
  for (const moving of [false, true]) {
    const manager = new VehicleManager(grid);
    const leader = manager.createLaneVehicle(graph, findLaneRoute(graph, '1,0:west', '4,0:west'), 5, undefined, 8);
    if (!moving) { leader.speed = 0; leader.cruiseSpeed = 0; }
    const follower = manager.createLaneVehicle(graph, findLaneRoute(graph, '-3,0:west', '3,0:west'), 5, undefined, 24);
    manager.update(1 / 60);
    assert.equal(manager.getIntersectionReservations().some((item) => item.vehicleId === follower.id), moving);
    // An externally stopped leader invalidates a clearance forecast before entry.
    leader.speed = 0; leader.cruiseSpeed = 0;
    for (let tick = 0; tick < 600; tick++) {
      manager.update(1 / 60);
      assert.ok(follower.frontAxle.x + follower.dimensions.frontOverhang < -5);
      assert.equal(bodiesOverlap(leader, follower), false);
    }
  }
});

test('following responds to leader speed and remains separated during maximum braking', () => {
  const grid = new GridManager(20, 20);
  for (let x = -8; x <= 8; x++) road(grid, x, 0, x === -8 ? ['east'] : x === 8 ? ['west'] : ['east', 'west']);
  const graph = buildLaneGraph(grid);
  const manager = new VehicleManager(grid);
  const route = findLaneRoute(graph, '-7,0:west', '7,0:west');
  const leader = manager.createLaneVehicle(graph, route, 5, undefined, 35);
  const follower = manager.createLaneVehicle(graph, route, 5, undefined, 25);
  for (let tick = 0; tick < 120; tick++) manager.update(1 / 60);
  near(follower.speed, 5);
  leader.cruiseSpeed = 0;
  for (let tick = 0; tick < 600; tick++) {
    manager.update(1 / 60);
    const gap = leader.rearRouteDistance - leader.dimensions.rearOverhang
      - follower.traveledDistance - follower.dimensions.frontOverhang;
    assert.ok(gap >= VehicleManager.minimumGap - 1e-8);
    assert.equal(bodiesOverlap(leader, follower), false);
  }
  assert.ok(follower.speed < 0.05);
});

test('an optimistic approach estimate never authorizes entry if the downstream vehicle stops', () => {
  const { grid, graph } = simpleCross();
  const manager = new VehicleManager(grid);
  const blocker = manager.createLaneVehicle(graph, findLaneRoute(graph, '1,0:west', '4,0:west'), 5, undefined, 5);
  const vehicle = manager.createLaneVehicle(graph, findLaneRoute(graph, '-3,0:west', '3,0:west'), 5, undefined, 24);
  for (let tick = 0; tick < 6; tick++) manager.update(1 / 60);
  // Deliberately invalidate the motion estimate: the exit must remain protected.
  blocker.speed = 0; blocker.cruiseSpeed = 0;
  for (let tick = 0; tick < 600; tick++) {
    manager.update(1 / 60);
    assert.ok(vehicle.frontAxle.x + vehicle.dimensions.frontOverhang < -5);
    assert.equal(manager.getIntersectionReservations().some((reservation) => reservation.vehicleId === vehicle.id), false);
  }
  assert.ok(vehicle.speed < 0.05);
});

function bodiesOverlap(a, b) {
  const axes = [a.tangent, b.tangent, { x: -a.tangent.y, y: a.tangent.x }, { x: -b.tangent.y, y: b.tangent.x }];
  const extent = (car, axis) => {
    const length = car.dimensions.wheelbase + car.dimensions.frontOverhang + car.dimensions.rearOverhang;
    return Math.abs(car.tangent.x * axis.x + car.tangent.y * axis.y) * length / 2
      + Math.abs(-car.tangent.y * axis.x + car.tangent.x * axis.y) * car.dimensions.width / 2;
  };
  return axes.every((axis) => Math.abs((a.position.x - b.position.x) * axis.x + (a.position.y - b.position.y) * axis.y)
    < extent(a, axis) + extent(b, axis) - 1e-6);
}

for (const [count, useOverrides] of [[4, false], [TEST_SCENARIO_CONFIG.circularVehicleCount, false], [TEST_SCENARIO_CONFIG.circularVehicleCount, true]]) {
test(`${count} cars ${useOverrides ? 'with fixed start' : 'with distributed starts'} repeatedly cross with no overlapping bodies or starvation`, () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const circles = circularTestRoutes(graph);
  const manager = new VehicleManager(grid);
  const cars = [];
  for (let index = 0; index < count; index++) {
    const circle = circles[index % circles.length];
    assert.ok(circle.route, circle.label);
    const route = circle.route;
    const first = graph.lanes.get(route.laneIds[0]), last = graph.lanes.get(route.laneIds.at(-1));
    assert.ok(last.nextLaneIds.includes(first.id));
    samePoint(sampleLane(last.trajectory, last.trajectory.length).position, sampleLane(first.trajectory, 0).position);
    const phases = TEST_SCENARIO_CONFIG.circularSpawnFractions;
    const wave = Math.floor(index / phases.length) / Math.ceil(TEST_SCENARIO_CONFIG.circularVehicleCount / phases.length);
    const initial = route.length * ((phases[index % phases.length] + wave) % 1);
    let car = null;
    const override = useOverrides && TEST_SCENARIO_CONFIG.circularStartOverrides.find((item) => item.number === index + 1);
    if (override) {
      let start = 0;
      for (const id of route.laneIds) {
        const lane = graph.lanes.get(id);
        if (lane.tileX === override.tileX && lane.tileY === override.tileY) {
          car = manager.createLaneVehicle(graph, route, 5, undefined, start + lane.trajectory.length * override.progress, true);
          break;
        }
        start += lane.trajectory.length;
      }
      assert.ok(manager.getIntersectionReservations().some((reservation) => reservation.vehicleId === car?.id));
      const lane = graph.lanes.get(car.laneIds[car.trajectoryIndex]);
      assert.equal(lane.tileX, override.tileX);
      assert.equal(lane.tileY, override.tileY);
    } else {
      for (let offset = 0; offset < route.length && !car; offset += TEST_SCENARIO_CONFIG.circularSpawnSearchStepMeters) {
        car = manager.createLaneVehicle(graph, route, 5, undefined, (initial + offset) % route.length);
      }
    }
    assert.ok(car, circle.label);
    cars.push(car);
  }
  let hadWaiting = false;
  let initialSpeedOfCar8 = Infinity;
  let speedOfCar12At0620 = Infinity;
  for (let tick = 0; tick < 12000; tick++) {
    manager.update(1 / 30);
    hadWaiting ||= cars.some((car) => car.speed < 4.9);
    if (count === 14 && tick < 120) initialSpeedOfCar8 = Math.min(initialSpeedOfCar8, cars[7].speed);
    // 06:20 spans physical seconds 25..37.5 at the configured city-clock ratio.
    if (count === 14 && useOverrides && tick >= 750 && tick < 1125) {
      speedOfCar12At0620 = Math.min(speedOfCar12At0620, cars[11].speed);
    }
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        assert.equal(bodiesOverlap(cars[i], cars[j]), false,
          `body overlap at tick ${tick}: cars ${i} / ${j}`);
      }
    }
  }
  assert.equal(manager.getVehicles().length, count);
  assert.ok(hadWaiting, 'conflicting movements must yield by slowing or waiting');
  if (count === 14) assert.ok(initialSpeedOfCar8 > 0.05, `car 8 stopped unnecessarily: ${initialSpeedOfCar8}`);
  if (count === 14 && useOverrides) assert.ok(speedOfCar12At0620 > 0.05, `car 12 stopped unnecessarily at 06:20: ${speedOfCar12At0620}`);
  for (const [index, car] of cars.entries()) assert.ok(car.completedLaps >= 2, `car ${index}: ${car.completedLaps} laps`);
});
}

test('three vehicles queue without overlap behind a long stopped leader, then restart', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const preset = testRoutes.find((item) => item.id === 'following');
  const route = findLaneRoute(graph, preset.start, preset.end);
  const manager = new VehicleManager(grid);
  const cars = [45, 25, 5].map((distance, i) => manager.createLaneVehicle(graph, route, 5,
    { wheelbase: i === 0 ? 4.5 : 2.6, frontOverhang: 0.7, rearOverhang: 1, width: 1.8, height: 1.3 }, distance));
  assert.ok(cars.every(Boolean));
  for (const car of cars) car.speed = 0;
  cars[0].cruiseSpeed = 0;
  assert.equal(manager.createLaneVehicle(graph, route, 5, cars[0].dimensions, 45), null);
  const assertGaps = () => {
    for (let i = 1; i < cars.length; i++) {
      const leader = cars[i - 1], follower = cars[i];
      const gap = leader.rearRouteDistance - leader.dimensions.rearOverhang
        - follower.traveledDistance - follower.dimensions.frontOverhang;
      assert.ok(gap >= VehicleManager.minimumGap - 1e-8, `unsafe gap: ${gap}`);
    }
  };
  for (let i = 0; i < 1200; i++) { manager.update(1 / 60); assertGaps(); }
  assert.ok(cars[1].speed < 0.01);
  assert.ok(cars[2].speed < 0.01);
  const stoppedAt = cars.map((car) => car.traveledDistance);
  cars[0].cruiseSpeed = 5;
  const started = [null, null, null];
  for (let i = 0; i < 600; i++) {
    manager.update(1 / 60); assertGaps();
    cars.forEach((car, index) => {
      if (started[index] === null && car.traveledDistance > stoppedAt[index] + 1e-5) started[index] = i / 60;
    });
  }
  assert.equal(started[0], 0);
  assert.ok(started[1] >= VehicleManager.queueReactionTime);
  assert.ok(started[2] >= started[1] + VehicleManager.queueReactionTime);
  for (let i = 0; i < cars.length; i++) assert.ok(cars[i].traveledDistance > stoppedAt[i] + 10);
  cars[0].cruiseSpeed = 0;
  for (let i = 0; i < 100; i++) { manager.update(0.2); assertGaps(); }
});

test('following motion is independent of insertion order', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const preset = testRoutes.find((item) => item.id === 'following');
  const route = findLaneRoute(graph, preset.start, preset.end);
  function setup(order) {
    const manager = new VehicleManager(grid);
    const cars = new Map();
    for (const distance of order) {
      const car = manager.createLaneVehicle(graph, route, 5, undefined, distance);
      if (distance === 45) { car.speed = 0; car.cruiseSpeed = 0; }
      cars.set(distance, car);
    }
    return { manager, cars };
  }
  const a = setup([45, 25, 5]), b = setup([5, 25, 45]);
  for (let i = 0; i < 300; i++) { a.manager.update(1 / 60); b.manager.update(1 / 60); }
  for (const distance of [45, 25, 5]) {
    near(a.cars.get(distance).traveledDistance, b.cars.get(distance).traveledDistance);
    near(a.cars.get(distance).speed, b.cars.get(distance).speed);
  }
});

test('lane vehicle conserves distance across curves and lane boundaries and signals arrival once', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const preset = testRoutes.find((item) => item.id === 'loop');
  const route = findLaneRoute(graph, preset.start, preset.end);
  const manager = new VehicleManager(grid);
  const vehicle = manager.createLaneVehicle(graph, route, 5);
  const split = structuredClone(vehicle);
  const first = vehicle.trajectories[0];
  advanceLaneVehicle(vehicle, first.length / 5 + 0.5);
  for (let i = 0; i < 10; i++) advanceLaneVehicle(split, (first.length / 5 + 0.5) / 10);
  samePoint(vehicle.position, split.position);
  samePoint(vehicle.tangent, split.tangent);
  assert.equal(vehicle.trajectoryIndex, 1);
  near(vehicle.distance, 2.5);
  const expected = sampleLane(vehicle.trajectories[1], 2.5);
  samePoint(vehicle.frontAxle, expected.position);
  let arrivals = 0;
  manager.onVehicleArrived(() => arrivals++);
  manager.update(route.length / 5 + 1);
  manager.update(1);
  assert.equal(arrivals, 1);
  assert.equal(manager.getVehicles().length, 0);
  assert.equal(manager.createLaneVehicle(graph, route, 0), null);
  assert.equal(manager.createLaneVehicle(graph, { laneIds: ['missing'], length: 1 }), null);
  assert.equal(manager.createLaneVehicle(graph, { laneIds: [preset.end, preset.start], length: 1 }), null);
});

test('simulation pause freezes a lane vehicle and resume continues without catching up', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const preset = testRoutes[0];
  const manager = new VehicleManager(grid);
  const vehicle = manager.createLaneVehicle(graph, findLaneRoute(graph, preset.start, preset.end));
  const simulation = new SimulationManager();
  simulation.register((dt) => manager.update(dt));
  simulation.update(0.1);
  near(vehicle.distance, 0.5);
  const position = { ...vehicle.position };
  simulation.pause();
  for (let i = 0; i < 60; i++) simulation.update(1);
  samePoint(vehicle.position, position);
  simulation.resume();
  simulation.update(0.1);
  near(vehicle.distance, 1);
  manager.removeVehicleForTest(vehicle.id);
  assert.equal(manager.getVehicles().length, 0);
  simulation.dispose();
});

test('two axle centres follow a curve with rigid wheelbase for short, normal and long vehicles', () => {
  const radius = 6.5;
  const path = { kind: 'arc', center: { x: 0, y: 0 }, radius, startAngle: 0, sweep: Math.PI / 2, length: radius * Math.PI / 2 };
  const graph = { lanes: new Map([['curve', { id: 'curve', trajectory: path, nextLaneIds: [] }]]) };
  const manager = new VehicleManager(new GridManager(20, 20));
  for (const wheelbase of [1.5, 2.6, 5]) {
    const dimensions = { wheelbase, frontOverhang: 0.8, rearOverhang: 0.6, width: 1.8, height: 1.3 };
    const vehicle = manager.createLaneVehicle(graph, { laneIds: ['curve'], length: path.length }, 5, dimensions);
    near(Math.hypot(vehicle.frontAxle.x - vehicle.rearAxle.x, vehicle.frontAxle.y - vehicle.rearAxle.y), wheelbase);
    advanceLaneVehicle(vehicle, 8 / 5);
    const frontAngle = 8 / radius;
    const rearAngle = frontAngle - 2 * Math.asin(wheelbase / (2 * radius));
    samePoint(vehicle.frontAxle, { x: radius * Math.cos(frontAngle), y: radius * Math.sin(frontAngle) });
    samePoint(vehicle.rearAxle, { x: radius * Math.cos(rearAngle), y: radius * Math.sin(rearAngle) });
    near(Math.hypot(vehicle.frontAxle.x - vehicle.rearAxle.x, vehicle.frontAxle.y - vehicle.rearAxle.y), wheelbase);
    samePoint(vehicle.tangent, { x: (vehicle.frontAxle.x - vehicle.rearAxle.x) / wheelbase, y: (vehicle.frontAxle.y - vehicle.rearAxle.y) / wheelbase });
    assert.ok(Math.hypot(vehicle.tangent.x + Math.sin(frontAngle), vehicle.tangent.y - Math.cos(frontAngle)) > 0.05);
  }
});

test('axles maintain their separation across trajectory boundaries with unequal overhangs', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  const preset = testRoutes.find((item) => item.id === 'loop');
  const route = findLaneRoute(graph, preset.start, preset.end);
  const vehicle = new VehicleManager(grid).createLaneVehicle(graph, route);
  for (let i = 0; i < 200; i++) {
    const finished = advanceLaneVehicle(vehicle, 0.1);
    near(Math.hypot(vehicle.frontAxle.x - vehicle.rearAxle.x, vehicle.frontAxle.y - vehicle.rearAxle.y), vehicle.dimensions.wheelbase);
    if (finished) break;
  }
});

test('Dijkstra minimizes physical length rather than number of lanes, and respects direction', () => {
  const lane = (id, length, nextLaneIds) => ({ id, trajectory: { length }, nextLaneIds });
  const graph = { lanes: new Map([
    ['a', lane('a', 2, ['b', 'c'])], ['b', lane('b', 50, ['e'])],
    ['c', lane('c', 3, ['d'])], ['d', lane('d', 4, ['e'])], ['e', lane('e', 5, [])],
  ]) };
  assert.deepEqual(findLaneRoute(graph, 'a', 'e'), { laneIds: ['a', 'c', 'd', 'e'], length: 14 });
  assert.deepEqual(findLaneRoute(graph, 'a', 'a'), { laneIds: ['a'], length: 2 });
  assert.equal(findLaneRoute(graph, 'e', 'a'), null);
  assert.equal(findLaneRoute(graph, 'missing', 'a'), null);
  assert.equal(findLaneRoute(graph, 'a', 'missing'), null);
  graph.lanes.get('d').nextLaneIds = ['c']; // Cycle must terminate and find the longer alternative.
  assert.deepEqual(findLaneRoute(graph, 'a', 'e'), { laneIds: ['a', 'b', 'e'], length: 57 });
});

test('development scenario routes join continuously; disconnected destination is unreachable', () => {
  const grid = new GridManager(20, 20);
  populateTestScenario(grid);
  const graph = buildLaneGraph(grid);
  for (const preset of testRoutes) {
    const route = findLaneRoute(graph, preset.start, preset.end);
    if (preset.id === 'unreachable') { assert.equal(route, null); continue; }
    assert.ok(route, preset.id);
    near(route.length, route.laneIds.reduce((sum, id) => sum + graph.lanes.get(id).trajectory.length, 0));
    for (let i = 1; i < route.laneIds.length; i++) {
      const previous = graph.lanes.get(route.laneIds[i - 1]);
      const current = graph.lanes.get(route.laneIds[i]);
      assert.ok(previous.nextLaneIds.includes(current.id));
      const end = sampleLane(previous.trajectory, previous.trajectory.length);
      const start = sampleLane(current.trajectory, 0);
      samePoint(end.position, start.position);
      samePoint(end.tangent, start.tangent);
    }
  }
  const across = testRoutes.find((item) => item.id === 'across');
  const initial = findLaneRoute(graph, across.start, across.end);
  disconnectRoad(grid, -2, 0);
  grid.setTile(-2, 0, createTile(-2, 0, 'empty'));
  const detour = findLaneRoute(buildLaneGraph(grid), across.start, across.end);
  assert.ok(detour.length > initial.length);
  assert.ok(!detour.laneIds.some((id) => id.startsWith('-2,0:')));
  disconnectRoad(grid, -2, -3);
  grid.setTile(-2, -3, createTile(-2, -3, 'empty'));
  // The new circular fixtures add another bypass on the opposite side.
  disconnectRoad(grid, -2, 3);
  grid.setTile(-2, 3, createTile(-2, 3, 'empty'));
  assert.equal(findLaneRoute(buildLaneGraph(grid), across.start, across.end), null);
});

test('right-hand traffic in the rendered X/Z plane: four independent cardinal cases', () => {
  const grid = new GridManager(8, 8);
  road(grid, 0, 0, sides);
  const graph = buildLaneGraph(grid);
  // Facing +Z, right is +X; facing +X, right is -Z.
  // Explicit examples avoid deriving expectations from the port implementation.
  const cases = [
    ['north', 'south', { x: 1.5, y: 0 }, { x: 0, y: 1 }],
    ['south', 'north', { x: -1.5, y: 0 }, { x: 0, y: -1 }],
    ['west', 'east', { x: 0, y: -1.5 }, { x: 1, y: 0 }],
    ['east', 'west', { x: 0, y: 1.5 }, { x: -1, y: 0 }],
  ];
  for (const [entry, exit, position, tangent] of cases) {
    const path = graph.lanes.get(`0,0:${entry}->${exit}`).trajectory;
    const middle = sampleLane(path, path.length / 2);
    samePoint(middle.position, position);
    samePoint(middle.tangent, tangent);
  }
  for (const lane of graph.lanes.values()) {
    if (lane.movement === 'right') near(lane.trajectory.radius, 3.5);
    if (lane.movement === 'left') near(lane.trajectory.radius, 6.5);
  }
});

test('all 16 connection patterns: all road shapes generate directed movements', () => {
  const grid = new GridManager(8, 8);
  assert.equal(buildLaneGraph(grid).lanes.size, 0);
  for (let mask = 0; mask < 16; mask++) {
    const connections = sides.filter((_, i) => mask & (1 << i));
    road(grid, 0, 0, connections);
    const lanes = [...buildLaneGraph(grid).lanes.values()];
    assert.equal(lanes.length, connections.length === 1 ? 2 : Math.max(0, connections.length * (connections.length - 1)));
    if (connections.length === 1) continue; // Terminal geometry is verified in all four orientations below.
    for (const lane of lanes) {
      assert.notEqual(lane.entry, lane.exit);
      assert.deepEqual(lane.nextLaneIds, []);
      const start = sampleLane(lane.trajectory, 0);
      const end = sampleLane(lane.trajectory, lane.trajectory.length);
      const [ax, ay] = vectors[lane.entry];
      const [bx, by] = vectors[lane.exit];
      samePoint(start.position, { x: ax * 5 - ay * 1.5, y: ay * 5 + ax * 1.5 });
      samePoint(end.position, { x: bx * 5 + by * 1.5, y: by * 5 - bx * 1.5 });
      samePoint(start.tangent, { x: -ax, y: -ay });
      samePoint(end.tangent, { x: bx, y: by });
      if (opposite[lane.entry] === lane.exit) {
        assert.equal(lane.trajectory.kind, 'line');
        near(lane.trajectory.length, 10);
      } else {
        assert.equal(lane.trajectory.kind, 'arc');
        assert.ok([3.5, 6.5].includes(lane.trajectory.radius));
        near(lane.trajectory.length, lane.trajectory.radius * Math.PI / 2);
      }
      samePoint(sampleLane(lane.trajectory, -1).position, start.position);
      samePoint(sampleLane(lane.trajectory, lane.trajectory.length + 1).position, end.position);
    }
  }
});

test('all 36 neighboring straight/curve combinations join in position and tangent, in both directions', () => {
  for (const side of sides) {
    const [x, y] = vectors[side];
    for (const otherA of sides.filter((item) => item !== side)) {
      for (const otherB of sides.filter((item) => item !== opposite[side])) {
        const grid = new GridManager(8, 8);
        road(grid, 0, 0, [side, otherA]);
        road(grid, x, y, [opposite[side], otherB]);
        const graph = buildLaneGraph(grid);
        let joins = 0;
        for (const lane of graph.lanes.values()) {
          if (!lane.nextLaneIds.length) continue;
          joins++;
          const next = graph.lanes.get(lane.nextLaneIds[0]);
          const end = sampleLane(lane.trajectory, lane.trajectory.length);
          const start = sampleLane(next.trajectory, 0);
          samePoint(end.position, start.position);
          samePoint(end.tangent, start.tangent);
        }
        assert.equal(joins, 2);
      }
    }
  }
});

test('one-sided connections never create implicit continuations', () => {
  const grid = new GridManager(8, 8);
  road(grid, 0, 0, ['east', 'west']);
  for (const neighbors of [['east', 'north']]) {
    road(grid, 1, 0, neighbors);
    assert.deepEqual(buildLaneGraph(grid).lanes.get('0,0:west').nextLaneIds, []);
  }
});

test('deleting a road and rebuilding removes stale lanes and links; clear empties the graph', () => {
  const grid = new GridManager(8, 8);
  for (let x = -1; x <= 1; x++) road(grid, x, 0, ['east', 'west']);
  assert.equal(buildLaneGraph(grid).lanes.size, 6);
  disconnectRoad(grid, 0, 0);
  grid.setTile(0, 0, createTile(0, 0, 'empty'));
  const remaining = buildLaneGraph(grid);
  assert.equal(remaining.lanes.size, 4);
  for (const lane of remaining.lanes.values()) {
    assert.notEqual(lane.tileX, 0);
    assert.deepEqual(lane.nextLaneIds, []);
  }
  grid.clear();
  assert.equal(buildLaneGraph(grid).lanes.size, 0);
});

test('all four ends reach the asphalt edge and join neighboring lanes without a U-turn', () => {
  for (const side of sides) {
    const [dx, dy] = vectors[side];
    const grid = new GridManager(8, 8);
    road(grid, 0, 0, [side]);
    road(grid, dx, dy, [opposite[side], side]);
    const graph = buildLaneGraph(grid);
    const incoming = graph.lanes.get(`0,0:${side}`);
    const outgoing = graph.lanes.get('0,0:terminal');
    assert.equal(incoming.exit, null);
    assert.deepEqual(incoming.nextLaneIds, []);
    assert.equal(outgoing.entry, null);
    assert.deepEqual(outgoing.nextLaneIds, [`${dx},${dy}:${opposite[side]}`]);
    assert.deepEqual(graph.lanes.get(`${dx},${dy}:${side}`).nextLaneIds, [incoming.id]);
    near(incoming.trajectory.length, 8);
    near(outgoing.trajectory.length, 8);
    const closedIn = sampleLane(incoming.trajectory, 8);
    const closedOut = sampleLane(outgoing.trajectory, 0);
    samePoint(closedIn.position, { x: -3 * dx - dy * 1.5, y: -3 * dy + dx * 1.5 });
    samePoint(closedOut.position, { x: -3 * dx + dy * 1.5, y: -3 * dy - dx * 1.5 });
    samePoint(closedIn.tangent, { x: -dx, y: -dy });
    samePoint(closedOut.tangent, { x: dx, y: dy });
    for (const lane of graph.lanes.values()) {
      if (!lane.nextLaneIds.length) continue;
      const end = sampleLane(lane.trajectory, lane.trajectory.length);
      const next = sampleLane(graph.lanes.get(lane.nextLaneIds[0]).trajectory, 0);
      samePoint(end.position, next.position);
      samePoint(end.tangent, next.tangent);
    }
  }
});

test('a two-tile road has two directed paths ending separately, without cycles', () => {
  const grid = new GridManager(8, 8);
  road(grid, 0, 0, ['east']);
  road(grid, 1, 0, ['west']);
  const graph = buildLaneGraph(grid);
  assert.equal(graph.lanes.size, 4);
  for (const start of graph.lanes.values()) {
    if (start.entry !== null) continue;
    const next = graph.lanes.get(start.nextLaneIds[0]);
    assert.equal(next.exit, null);
    assert.deepEqual(next.nextLaneIds, []);
  }
});

test('all T orientations have 6 movements; a cross has 12, with no U-turns and stable IDs', () => {
  for (const missing of [...sides, null]) {
    const grid = new GridManager(8, 8);
    const connected = sides.filter((side) => side !== missing);
    road(grid, 0, 0, connected);
    const graph = buildLaneGraph(grid);
    assert.equal(graph.lanes.size, missing ? 6 : 12);
    assert.deepEqual([...graph.lanes.keys()], [...buildLaneGraph(grid).lanes.keys()]);
    for (const entry of connected) {
      const movements = [...graph.lanes.values()].filter((lane) => lane.entry === entry);
      assert.equal(movements.length, connected.length - 1);
      assert.equal(new Set(movements.map((lane) => lane.exit)).size, movements.length);
      for (const movement of movements) {
        assert.notEqual(movement.entry, movement.exit);
        assert.ok(connected.includes(movement.exit));
        if (opposite[entry] === movement.exit) assert.equal(movement.movement, 'straight');
        else {
          const [ax, ay] = vectors[entry];
          const [bx, by] = vectors[movement.exit];
          assert.equal(movement.movement, -ax * by + ay * bx < 0 ? 'right' : 'left');
        }
      }
    }
  }
});

test('all neighboring shapes preserve position/tangent for every alternative, including adjacent junctions', () => {
  for (const side of sides) {
    const [x, y] = vectors[side];
    const aOptions = sides.filter((item) => item !== side);
    const bOptions = sides.filter((item) => item !== opposite[side]);
    for (let maskA = 0; maskA < 8; maskA++) {
      for (let maskB = 0; maskB < 8; maskB++) {
        const grid = new GridManager(8, 8);
        const aSides = [side, ...aOptions.filter((_, i) => maskA & (1 << i))];
        const bSides = [opposite[side], ...bOptions.filter((_, i) => maskB & (1 << i))];
        road(grid, 0, 0, aSides);
        road(grid, x, y, bSides);
        const graph = buildLaneGraph(grid);
        for (const lane of graph.lanes.values()) {
          const leavesForNeighbor = lane.tileX === 0 && lane.tileY === 0 ? lane.exit === side : lane.exit === opposite[side];
          const neighborAccesses = lane.tileX === 0 && lane.tileY === 0 ? bSides.length : aSides.length;
          assert.equal(lane.nextLaneIds.length, leavesForNeighbor ? Math.max(1, neighborAccesses - 1) : 0);
          for (const nextId of lane.nextLaneIds) {
            const next = graph.lanes.get(nextId);
            const end = sampleLane(lane.trajectory, lane.trajectory.length);
            const start = sampleLane(next.trajectory, 0);
            samePoint(end.position, start.position);
            samePoint(end.tangent, start.tangent);
          }
        }
      }
    }
  }
});

test('disconnecting a cross removes obsolete movements and updates all incoming alternatives', () => {
  const grid = new GridManager(8, 8);
  road(grid, 0, 0, sides);
  for (const side of sides) {
    const [x, y] = vectors[side];
    road(grid, x, y, [opposite[side]]);
  }
  const before = buildLaneGraph(grid);
  assert.equal(before.lanes.get('0,-1:terminal').nextLaneIds.length, 3);
  disconnectRoad(grid, 1, 0);
  grid.setTile(1, 0, createTile(1, 0, 'empty'));
  const after = buildLaneGraph(grid);
  assert.equal([...after.lanes.values()].filter((lane) => lane.tileX === 0 && lane.tileY === 0).length, 6);
  assert.equal(after.lanes.get('0,-1:terminal').nextLaneIds.length, 2);
  for (const lane of after.lanes.values()) {
    assert.ok(!(lane.tileX === 1 && lane.tileY === 0));
    for (const id of lane.nextLaneIds) assert.ok(after.lanes.has(id));
    if (lane.tileX === 0 && lane.tileY === 0) {
      assert.notEqual(lane.entry, 'east');
      assert.notEqual(lane.exit, 'east');
    }
  }
});

test('simulation speed multiplies fixed steps, respects pause and resets for a new game', () => {
  const simulation = new SimulationManager();
  const deltas = [];
  simulation.register((dt) => deltas.push(dt));
  simulation.update(1 / 60);
  assert.equal(deltas.length, 1);
  simulation.setSpeedMultiplier(2);
  simulation.update(1 / 60);
  assert.equal(deltas.length, 3);
  simulation.setSpeedMultiplier(4);
  simulation.update(1 / 60);
  assert.equal(deltas.length, 7);
  assert.ok(deltas.every((dt) => dt === 1 / 60));
  simulation.pause();
  simulation.update(1);
  assert.equal(deltas.length, 7);
  simulation.resume();
  simulation.setSpeedMultiplier(2);
  simulation.update(1 / 60);
  assert.equal(deltas.length, 9);
  simulation.resetClock();
  assert.equal(simulation.getSpeedMultiplier(), 1);
  simulation.update(1 / 60);
  assert.equal(deltas.length, 10);
});
