const createParticleSystem = (location) => {
  const origin = location.copy();

  const particles = [];

  const addParticle = (velocity) => {
    const rand = random(0, 1);
    if (rand <= 0.3) {
      particles.push(createSparkParticle(origin, velocity.copy()));
    } else {
      particles.push(createParticle(origin, velocity.copy()));
    }
  };

  const applyForce = (force) => {
    particles.forEach((particle) => {
      particle.applyForce(force);
    });
  };

  const run = () => {
    // ellipse(origin.x, origin.y, 10, 10);
    particles.forEach((particle, index) => {
      particle.move();
      particle.draw();

      if (particle.isDead()) {
        particles.splice(index, 1);
      }
    });
  };

  return {
    origin,
    addParticle,
    run,
    applyForce,
  };
};

const createSparkParticle = (locationP, velocity) => {
  const particle = createParticle(locationP, velocity);
  let fade = 255;

  const draw = () => {
    colorMode(HSB);

    stroke(16, 62, 100, fade);

    const arrow = velocity.copy().normalize().mult(random(2, 4));

    const direction = p5.Vector.add(particle.location, arrow);

    line(particle.location.x, particle.location.y, direction.x, direction.y);
  };

  const move = () => {
    particle.applyForce(createVector(random(-0.2, 0.2), random(-0.1, -0.4)));

    particle.velocity.add(particle.acc);
    particle.location.add(
      particle.velocity.copy().normalize().mult(random(2, 4))
    );
    particle.acc.mult(0);
    fade -= 5;
  };

  return {
    ...particle,
    draw,
    move,
  };
};

const createParticle = (locationP, velocity) => {
  const acc = createVector(0, 0);
  const location = locationP.copy();
  let fade = 255;
  const fadeMinus = randomGaussian(15, 2);
  let ligther = 100;
  let situate = 62;

  const draw = () => {
    colorMode(HSB);
    stroke(16, constrain(situate, 62, 92), constrain(ligther, 60, 100), fade);

    const arrow = velocity.copy().mult(2);

    const direction = p5.Vector.add(location, arrow);

    line(location.x, location.y, direction.x, direction.y);
  };

  const move = () => {
    velocity.add(acc);
    location.add(velocity.copy().div(map(velocity.mag(), 18, 0, 5, 1)));
    acc.mult(0);
    fade -= fadeMinus;
    ligther -= 8;
    situate += 8;
  };

  const applyForce = (force) => {
    acc.add(force);
  };

  const isDead = () => {
    if (
      fade < 0 ||
      location.x < 0 ||
      location.x > width ||
      location.y > height
    ) {
      return true;
    } else {
      return false;
    }
  };

  return {
    draw,
    move,
    applyForce,
    isDead,
    velocity,
    location,
    acc,
  };
};

const createMover = () => {
  const location = createVector(350, 250);
  const velocity = createVector(0, 0);
  const acc = createVector(0, 0);
  const mass = 10;

  let angle = 0;
  let angleVelocity = 0;
  let angleAcc = 0;
  let len = 100;

  const particleSystems = [
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
    createParticleSystem(location),
  ];

  const getGotoVector = (angle) => {
    const radius = map(angleVelocity, 0, 0.3, 0, 100);
    const goToVector = createVector(
      location.x + radius * cos(angle),
      location.y + radius * sin(angle)
    );

    return goToVector;
  };

  const draw = () => {
    const goToVector = getGotoVector(angle);
    particleSystems.forEach((particleSystem) => {
      particleSystem.run();
    });
  };

  const renderParticleSystem = () => {
    particleSystems.forEach((particleSystem) => {
      const goToVector = getGotoVector(angle - Math.random(0, TWO_PI));

      const prepencular = createVector(
        goToVector.y - location.y,
        (goToVector.x - location.x) * -1
      );

      prepencular.normalize();
      prepencular.mult(angleVelocity * 70);

      particleSystem.origin.set(goToVector);

      particleSystem.addParticle(prepencular);

      const gravity = createVector(0, 0.3);

      particleSystem.applyForce(gravity);
    });
  };

  const move = () => {
    angleAcc = 0.001;

    angleVelocity = constrain(angleVelocity + angleAcc, 0, 0.32);

    angle += angleVelocity;

    angleAcc = 0;

    renderParticleSystem();
  };

  return {
    draw,
    move,
  };
};

let mover;

function setup() {
  createCanvas(700, 500);
  mover = createMover();
}

function draw() {
  clear();
  mover.move();
  mover.draw();
}

// console.log("hello");
