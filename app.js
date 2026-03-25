(function () {
  const STORAGE_KEY = "pike-shotte-field-companion-v1";
  const data = window.PikeShotteData;
  const specialRuleLookup = buildSpecialRuleLookup();
  const armyPresetSections = getArmyPresetSections();
  const armyPresets = getArmyPresets();
  const unitArtLookup = {
    "pike-block": "./assets/unit-arts/pike-block.jpg",
    musketeers: "./assets/unit-arts/musketeers.jpg",
    "pike-and-shot": "./assets/unit-arts/pike-and-shot.jpg",
    cuirassiers: "./assets/unit-arts/cuirassiers.jpg",
    dragoons: "./assets/unit-arts/dragoons.jpg",
    lancers: "./assets/unit-arts/lancers.jpg",
    "firelock-infantry": "./assets/unit-arts/firelock-infantry.jpg",
    "guard-infantry": "./assets/unit-arts/guard-infantry.jpg",
    warband: "./assets/unit-arts/warband.jpg",
    artillery: "./assets/unit-arts/artyl.jpg",
    baggage: "./assets/unit-arts/baggage.jpg"
  };

  const refs = {
    statusTurn: document.getElementById("status-turn"),
    statusSide: document.getElementById("status-side"),
    statusPhase: document.getElementById("status-phase"),
    phaseStrip: document.getElementById("phase-strip"),
    phaseHelpGrid: document.getElementById("phase-help-grid"),
    phaseCard: document.getElementById("phase-card"),
    quickTables: document.getElementById("quick-tables"),
    armiesSection: document.getElementById("armies"),
    armyDemoGrid: document.getElementById("army-demo-grid"),
    armiesGrid: document.getElementById("armies-grid"),
    referenceGrid: document.getElementById("reference-grid"),
    referenceSearch: document.getElementById("reference-search"),
    archetypeGrid: document.getElementById("archetype-grid"),
    unitSearch: document.getElementById("unit-search"),
    specialRuleGrid: document.getElementById("special-rule-grid"),
    specialRuleSearch: document.getElementById("special-rule-search"),
    importFileInput: document.getElementById("import-file-input"),
    battaliaDialog: document.getElementById("battalia-dialog"),
    battaliaForm: document.getElementById("battalia-form"),
    unitDialog: document.getElementById("unit-dialog"),
    unitForm: document.getElementById("unit-form"),
    unitTemplate: document.getElementById("unit-template")
  };

  let state = loadState() || createDefaultState();

  initialize();
  renderAll();

  function initialize() {
    renderTemplateOptions();

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
    });

    document.getElementById("prev-phase").addEventListener("click", () => stepPhase(-1));
    document.getElementById("next-phase").addEventListener("click", () => stepPhase(1));
    document.getElementById("reset-state").addEventListener("click", () => {
      if (resetState()) {
        closeUtilityMenu("army-session-panel");
      }
    });
    document.getElementById("export-state").addEventListener("click", () => {
      exportState();
      closeUtilityMenu("army-session-panel");
    });
    document.getElementById("import-state").addEventListener("click", () => {
      closeUtilityMenu("army-session-panel");
      refs.importFileInput.click();
    });

    refs.importFileInput.addEventListener("change", handleImportFile);

    refs.referenceSearch.addEventListener("input", renderReference);
    refs.unitSearch.addEventListener("input", renderUnits);
    refs.specialRuleSearch.addEventListener("input", renderUnits);

    refs.armiesSection.addEventListener("click", handleArmyGridClick);
    refs.armiesGrid.addEventListener("input", handleArmyGridInput);

    refs.battaliaForm.addEventListener("submit", handleBattaliaSubmit);
    refs.unitForm.addEventListener("submit", handleUnitSubmit);
    refs.unitTemplate.addEventListener("change", handleTemplateChange);

    document.body.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-dialog-close]");
      if (!closeTarget) {
        return;
      }

      const dialog = document.getElementById(closeTarget.dataset.dialogClose);
      if (dialog) {
        dialog.close();
      }
    });

    setActiveTab(document.querySelector(".tab.is-active")?.dataset.tabTarget || "dashboard");
  }

  function createDefaultState() {
    return {
      turn: 1,
      activePhaseIndex: 0,
      armyView: "solo",
      soloArmyId: "blue",
      globalNotes: "",
      armies: {
        blue: createArmy("blue", "Синяя армия"),
        red: createArmy("red", "Красная армия")
      }
    };
  }

  function createArmy(id, name) {
    return {
      id,
      name,
      objective: "",
      battalias: []
    };
  }

  function createBattalia(values) {
    return {
      id: uid("battalia"),
      name: values.name || "Новая баталия",
      commander: values.commander || "",
      commandRating: Number(values.commandRating) || 8,
      type: values.type || "foot",
      notes: values.notes || "",
      units: []
    };
  }

  function createUnitFromTemplate(templateId, nameOverride) {
    const template = getTemplateById(templateId);
    return {
      id: uid("unit"),
      templateId: template.id,
      name: nameOverride || template.name,
      category: template.category,
      formation: template.formation,
      armament: template.armament,
      move: template.move,
      shoot: template.shoot,
      range: template.range,
      melee: template.melee,
      morale: template.morale,
      stamina: Number(template.stamina) || 3,
      artKey: template.artKey || "",
      pointsOverride: Number.isFinite(Number(template.pointsOverride)) ? Number(template.pointsOverride) : null,
      pointsShootValue: Number.isFinite(Number(template.pointsShootValue)) ? Number(template.pointsShootValue) : null,
      pointsUnavailable: Boolean(template.pointsUnavailable),
      specialRules: template.specialRules,
      notes: template.notes,
      casualties: 0,
      disordered: false,
      activated: false,
      reactionUsed: false,
      combatRole: "free",
      lossState: "active"
    };
  }

  function seedDemoState() {
    loadDemoPreset("learning");
  }

  function getDemoPresets() {
    return [
      {
        id: "learning",
        name: "Учебная партия",
        summary: "Две баталии на сторону для спокойного входа в фазу приказов, стрельбу и первую рукопашную.",
        tags: ["2 баталии", "основа правил", "короткая партия"],
        buildState: () => createPresetState({
          blue: {
            name: "Парламентский авангард",
            objective: "Удержать гребень, не подпустить конницу противника к линии мушкетёров.",
            battalias: [
              {
                name: "Линия пики и мушкета",
                commander: "Сэр Артур",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Пиковый блок" },
                  { templateId: "musketeers", name: "Левое крыло мушкетёров" },
                  { templateId: "musketeers", name: "Правое крыло мушкетёров" }
                ]
              },
              {
                name: "Правый конный фланг",
                commander: "Полк. Харкорт",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Конный полк А" },
                  { templateId: "cavalry", name: "Конный полк Б" }
                ]
              }
            ]
          },
          red: {
            name: "Роялистский передовой отряд",
            objective: "Сорвать строй центра и открыть проход своей коннице на один из флангов.",
            battalias: [
              {
                name: "Пехотная баталия роялистов",
                commander: "Лорд Эшфорд",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Пики ветеранов" },
                  { templateId: "musketeers", name: "Левые мушкетёры" },
                  { templateId: "musketeers", name: "Правые мушкетёры" }
                ]
              },
              {
                name: "Орудийная линия",
                commander: "Мастер-канонир Хейл",
                commandRating: 7,
                type: "artillery",
                units: [
                  { templateId: "medium-artillery", name: "Батарея сакеров" }
                ]
              }
            ]
          }
        })
      },
      {
        id: "line-battle",
        name: "Линейное сражение",
        summary: "Классический стол Pike & Shotte: пехотный центр, конные крылья, батарея и несколько баталий для морали армии.",
        tags: ["классика pike & shotte", "4 баталии", "длиннее партия"],
        buildState: () => createPresetState({
          blue: {
            name: "Левое крыло коалиции",
            objective: "Удержать деревню и не допустить прорыва вдоль дороги через центр.",
            battalias: [
              {
                name: "Передняя линия",
                commander: "Ген. Уитби",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Центральный пиковый блок" },
                  { templateId: "musketeers", name: "Мушкетёры слева" },
                  { templateId: "musketeers", name: "Мушкетёры справа" }
                ]
              },
              {
                name: "Резерв пехоты",
                commander: "Полк. Монтегю",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Резервный пиковый блок" },
                  { templateId: "musketeers", name: "Резервные мушкетёры слева" },
                  { templateId: "musketeers", name: "Резервные мушкетёры справа" }
                ]
              },
              {
                name: "Конница прикрытия",
                commander: "Сэр Уилкотт",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Левый конный полк" },
                  { templateId: "cavalry", name: "Правый конный полк" },
                  { templateId: "cavalry", name: "Резерв эскадронов" }
                ]
              },
              {
                name: "Батарея позиции",
                commander: "Кап. Рид",
                commandRating: 7,
                type: "artillery",
                units: [
                  { templateId: "medium-artillery", name: "Средняя батарея" }
                ]
              }
            ]
          },
          red: {
            name: "Королевская полевая армия",
            objective: "Пробить пехотный центр, заставить минимум две баталии противника дрогнуть и развернуть успех конницей.",
            battalias: [
              {
                name: "Ударный центр",
                commander: "Лорд Марлоу",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Пики королевского центра" },
                  { templateId: "musketeers", name: "Огневая линия слева" },
                  { templateId: "musketeers", name: "Огневая линия справа" }
                ]
              },
              {
                name: "Вторая линия",
                commander: "Сэр Джулиан Брук",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Пики резерва" },
                  { templateId: "musketeers", name: "Мушкетёры резерва слева" },
                  { templateId: "musketeers", name: "Мушкетёры резерва справа" }
                ]
              },
              {
                name: "Конное крыло",
                commander: "Принц Руперт",
                commandRating: 9,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Тяжёлый конный полк" },
                  { templateId: "cavalry", name: "Конница атаки" },
                  { templateId: "cavalry", name: "Эскадрон преследования" }
                ]
              },
              {
                name: "Полевые орудия",
                commander: "Майор Кейн",
                commandRating: 7,
                type: "artillery",
                units: [
                  { templateId: "medium-artillery", name: "Полевые сакеры" }
                ]
              }
            ]
          }
        })
      },
      {
        id: "flank-attack",
        name: "Фланговый удар",
        summary: "Манёвренный стол с тяжёлой конницей, экраном и подвижной завесой для игры на обход и контратаку.",
        tags: ["конница", "манёвр", "быстрый темп"],
        buildState: () => createPresetState({
          blue: {
            name: "Конное крыло Севера",
            objective: "Обойти противника, расшатать строй огнём завесы и ударить конницей в открытый фланг.",
            battalias: [
              {
                name: "Тяжёлая конница",
                commander: "Граф Нортон",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Кирасиры графа" },
                  { templateId: "cavalry", name: "Конный резерв" },
                  {
                    templateId: "custom",
                    name: "Лёгкая конница разведки",
                    category: "horse",
                    formation: "skirmish",
                    armament: "Карабины и сабли",
                    move: "12\"",
                    shoot: "1",
                    range: "12\"",
                    melee: "4",
                    morale: "5+",
                    stamina: 2,
                    specialRules: "Рассыпной строй, уклонение",
                    notes: "Экран и разведка: играет от скорости, а не от затяжной рукопашной."
                  }
                ]
              },
              {
                name: "Конная завеса",
                commander: "Кап. Фенвик",
                commandRating: 8,
                type: "mixed",
                units: [
                  {
                    templateId: "custom",
                    name: "Драгуны передовой линии",
                    category: "horse",
                    formation: "skirmish",
                    armament: "Карабины и короткие клинки",
                    move: "9\"",
                    shoot: "2",
                    range: "12\"",
                    melee: "3",
                    morale: "5+",
                    stamina: 3,
                    specialRules: "Драгуны (Dragoons), Огонь и отход (Fire & Evade)",
                    notes: "Практический профиль для экрана и тревожащего огня по правилам драгун."
                  },
                  { templateId: "musketeers", name: "Приданные мушкетёры", formation: "skirmish", notes: "Поддержка местности и добивание потрясённых целей." }
                ]
              }
            ]
          },
          red: {
            name: "Пехотный заслон долины",
            objective: "Сдержать конные обходы, заставить противника атаковать в неудобный фронт и сохранить батарею.",
            battalias: [
              {
                name: "Пехотный узел",
                commander: "Сэр Бэзил Грант",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Узел пик" },
                  { templateId: "musketeers", name: "Мушкетёры левого сектора" },
                  { templateId: "musketeers", name: "Мушкетёры правого сектора" }
                ]
              },
              {
                name: "Конный ответ",
                commander: "Лорд Хейлс",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Контратакующий полк" },
                  { templateId: "cavalry", name: "Резерв конницы" }
                ]
              },
              {
                name: "Дорожная батарея",
                commander: "Мастер-канонир Вейн",
                commandRating: 7,
                type: "artillery",
                units: [
                  { templateId: "medium-artillery", name: "Среднее орудие заслона" }
                ]
              }
            ]
          }
        })
      },
      {
        id: "baggage-raid",
        name: "Охрана обоза",
        summary: "Асимметричная партия на цели: одна сторона выводит колонну снабжения, другая ловит её на марше.",
        tags: ["обоз", "цели на столе", "асимметрия"],
        buildState: () => createPresetState({
          blue: {
            name: "Колонна снабжения",
            objective: "Провести обоз к дороге выхода и не потерять батарею прикрытия.",
            battalias: [
              {
                name: "Передовая пехота",
                commander: "Полк. Эймс",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "pike-block", name: "Пики головного отряда" },
                  { templateId: "musketeers", name: "Мушкетёры охраны слева" },
                  { templateId: "musketeers", name: "Мушкетёры охраны справа" }
                ]
              },
              {
                name: "Обоз и орудия",
                commander: "Кап. Лоусон",
                commandRating: 7,
                type: "mixed",
                units: [
                  {
                    templateId: "custom",
                    name: "Обоз снабжения",
                    category: "baggage",
                    formation: "column",
                    armament: "Повозки, припасы и охрана",
                    move: "6\"",
                    shoot: "-",
                    range: "-",
                    melee: "1",
                    morale: "6+",
                    stamina: 2,
                    specialRules: "",
                    notes: "Сценарная цель: потеря этого юнита считается провалом прикрытия колонны."
                  },
                  { templateId: "medium-artillery", name: "Пушка сопровождения" }
                ]
              },
              {
                name: "Конный арьергард",
                commander: "Сэр Ли",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Арьергардный эскадрон" },
                  { templateId: "cavalry", name: "Фланговый эскадрон" }
                ]
              }
            ]
          },
          red: {
            name: "Рейдовый отряд",
            objective: "Разбить охрану колонны, достать обоз и вынудить его выйти со стола в беспорядке.",
            battalias: [
              {
                name: "Рейдовая конница",
                commander: "Кап. Роуч",
                commandRating: 8,
                type: "horse",
                units: [
                  { templateId: "cavalry", name: "Передовой рейдовый полк" },
                  { templateId: "cavalry", name: "Полк преследования" },
                  {
                    templateId: "custom",
                    name: "Разъезд лёгкой конницы",
                    category: "horse",
                    formation: "skirmish",
                    armament: "Карабины и сабли",
                    move: "12\"",
                    shoot: "1",
                    range: "12\"",
                    melee: "4",
                    morale: "5+",
                    stamina: 2,
                    specialRules: "Рассыпной строй",
                    notes: "Завязка боя, перехват дороги и охота за обозом."
                  }
                ]
              },
              {
                name: "Пехота перекрытия",
                commander: "Майор Сэндвелл",
                commandRating: 8,
                type: "foot",
                units: [
                  { templateId: "musketeers", name: "Застрельщики дороги" },
                  { templateId: "musketeers", name: "Пехота у изгородей" }
                ]
              }
            ]
          }
        })
      }
    ];
  }

  function createPresetState(configuration) {
    const nextState = createDefaultState();
    nextState.turn = 1;
    nextState.activePhaseIndex = 0;
    nextState.armyView = "solo";

    ["blue", "red"].forEach((armyId) => {
      const armyConfig = configuration[armyId];
      nextState.armies[armyId].name = armyConfig.name;
      nextState.armies[armyId].objective = armyConfig.objective || "";
      nextState.armies[armyId].battalias = (armyConfig.battalias || []).map(createPresetBattalia);
    });

    return nextState;
  }

  function createPresetBattalia(definition) {
    const battalia = createBattalia(definition);
    battalia.commandRating = Math.max(5, Math.min(10, Number(definition.commandRating) || 8));
    battalia.units = (definition.units || []).map(createPresetUnit);
    return battalia;
  }

  function createPresetUnit(definition) {
    const { templateId = "custom", name, ...overrides } = definition;
    const unit = createUnitFromTemplate(templateId, name);
    Object.assign(unit, overrides);
    unit.templateId = templateId;
    unit.name = name || unit.name;
    unit.stamina = Math.max(1, Number(unit.stamina) || 3);
    syncUnitTemplateMetadata(unit);
    unit.casualties = 0;
    unit.disordered = false;
    unit.activated = false;
    unit.reactionUsed = false;
    unit.combatRole = "free";
    unit.lossState = "active";
    return unit;
  }

  function loadDemoPreset(presetId) {
    const demoPresets = getDemoPresets();
    const preset = demoPresets.find((item) => item.id === presetId);
    if (!preset) {
      return false;
    }

    if (hasBattleContent() && !window.confirm(`Заменить текущие армии на демо-состав «${preset.name}»?`)) {
      return false;
    }

    closeUtilityMenu("army-library-panel");
    state = preset.buildState();
    renderAll();
    setActiveTab("armies");
    return true;
  }

  function hasBattleContent() {
    return ["blue", "red"].some((armyId) => state.armies[armyId].battalias.length > 0);
  }

  function getArmyPresetSections() {
    return [
      {
        id: "small-engagements",
        label: "Малые столкновения",
        pointsLabel: "120-180 pts",
        description: "Передовые отряды, рейды, горные вылазки и быстрые бои за подходы."
      },
      {
        id: "field-battles",
        label: "Стандартное полевое сражение",
        pointsLabel: "180-260 pts",
        description: "Сбалансированные армии для основной партии по системе очков из рульбука."
      },
      {
        id: "decisive-assaults",
        label: "Решающий удар и прорыв",
        pointsLabel: "240-320 pts",
        description: "Более тяжёлые сборки под сильный фланг, плотный центр или вторую линию."
      },
      {
        id: "late-linear-war",
        label: "Поздняя линейная война",
        pointsLabel: "260-360 pts",
        description: "Поздний период с firelocks, first fire и более стройной огневой линией."
      }
    ];
  }

  function getArmyPresets() {
    return [
      {
        id: "montrose-highland-host",
        sectionId: "small-engagements",
        name: "Горский корпус Монтроза",
        theatre: "Английская гражданская война",
        summary: "Армия короткой дистанции: горцы на прорыв, немного конницы и резкая атака на одном участке.",
        art: "./assets/unit-arts/warband.jpg",
        artPosition: "center 42%",
        army: {
          name: "Горский корпус Монтроза",
          objective: "Сломать один участок линии яростным броском и не дать противнику выиграть перестрелкой.",
          battalias: [
            {
              name: "Горский кулак",
              commander: "Маркиз Монтроз",
              commandRating: 8,
              type: "foot",
              units: [
                { templateId: "highland-warband", name: "Клан Кэмеронов" },
                { templateId: "highland-warband", name: "Клан Макдональдов" }
              ]
            },
            {
              name: "Конный заслон",
              commander: "Аласдер Макколла",
              commandRating: 7,
              type: "horse",
              units: [
                { templateId: "light-cavalry", name: "Горская конница" },
                { templateId: "dragoons", name: "Стрелки Монтроза" }
              ]
            }
          ]
        }
      },
      {
        id: "swedish-brigade",
        sectionId: "field-battles",
        name: "Шведская бригада",
        theatre: "Тридцатилетняя война",
        summary: "Сбалансированная полевая армия с линейной пехотой, гибкой конницей и бригадной пушкой.",
        art: "./assets/unit-arts/pike-and-shot.jpg",
        artPosition: "center 34%",
        army: {
          name: "Шведская бригада",
          objective: "Продвигаться организованными волнами и выигрывать бой темпом приказов, а не одной лобовой схваткой.",
          battalias: [
            {
              name: "Линейная бригада",
              commander: "Ген. Банер",
              commandRating: 8,
              type: "foot",
              units: [
                { templateId: "pike-company-infantry", name: "Батальон центра" },
                { templateId: "musketeers", name: "Лёгкий батальон слева" },
                { templateId: "musketeers", name: "Лёгкий батальон справа" }
              ]
            },
            {
              name: "Подвижная конница",
              commander: "Полк. Торстенссон",
              commandRating: 8,
              type: "horse",
              units: [
                { templateId: "cavalry", name: "Линия рейтаров" },
                { templateId: "light-cavalry", name: "Разъезд конницы" }
              ]
            },
            {
              name: "Орудия центра",
              commander: "Кап. Столь",
              commandRating: 6,
              type: "artillery",
              units: [
                { templateId: "medium-artillery", name: "Бригадная пушка" }
              ]
            }
          ]
        }
      },
      {
        sectionId: "decisive-assaults",
        id: "french-ordonnance",
        name: "Французская ордонансная армия",
        theatre: "Итальянские войны",
        summary: "Жандармы и швейцарский центр: ранний Pike & Shotte как один концентрированный удар.",
        art: "./assets/arts/scenario-cavalry.jpg",
        artPosition: "center 38%",
        army: {
          name: "Французская ордонансная армия",
          objective: "Сковать противника центром и решить бой быстрым ударом жандармов по одному направлению.",
          battalias: [
            {
              name: "Швейцарский центр",
              commander: "Сеньор де Лотрек",
              commandRating: 8,
              type: "foot",
              units: [
                { templateId: "pike-block", name: "Швейцарские пики" },
                { templateId: "musketeers", name: "Аркебузиры слева" },
                { templateId: "musketeers", name: "Аркебузиры справа" }
              ]
            },
            {
              name: "Жандармы авангарда",
              commander: "Герцог де Немур",
              commandRating: 8,
              type: "horse",
              units: [
                { templateId: "lancers", name: "Жандармы первой линии" },
                { templateId: "lancers", name: "Жандармы резерва" }
              ]
            },
            {
              name: "Орудия прорыва",
              commander: "Мастер Жирар",
              commandRating: 6,
              type: "artillery",
              units: [
                { templateId: "medium-artillery", name: "Фальконет батареи" }
              ]
            }
          ]
        }
      },
      {
        id: "grand-alliance",
        sectionId: "late-linear-war",
        name: "Бригада Великого альянса",
        theatre: "Войны Людовика XIV",
        summary: "Поздний Pike & Shotte: линия, первый залп, штыки-пробки и более дисциплинированное командование.",
        art: "./assets/arts/scenario-firelock.jpg",
        artPosition: "center 32%",
        army: {
          name: "Бригада Великого альянса",
          objective: "Удерживать строй залпами, защищать городские подступы и не отдавать инициативу французскому флангу.",
          battalias: [
            {
              name: "Линейная пехота",
              commander: "Принц Вальдек",
              commandRating: 8,
              type: "foot",
              units: [
                { templateId: "guard-infantry", name: "Голландская гвардия" },
                { templateId: "firelock-infantry", name: "Британский батальон" },
                { templateId: "firelock-infantry", name: "Союзный батальон" }
              ]
            },
            {
              name: "Конно-драгунский фланг",
              commander: "Ген. Оверкерк",
              commandRating: 8,
              type: "horse",
              units: [
                { templateId: "cavalry", name: "Конница Альянса" },
                { templateId: "light-cavalry", name: "Лёгкая конница" }
              ]
            },
            {
              name: "Драгуны под прикрытием",
              commander: "Кап. Тальмаш",
              commandRating: 7,
              type: "mixed",
              units: [
                { templateId: "dragoons", name: "Драгуны гарнизона" }
              ]
            },
            {
              name: "Полковая артиллерия",
              commander: "Мастер Блюм",
              commandRating: 6,
              type: "artillery",
              units: [
                { templateId: "medium-artillery", name: "Орудие центра" }
              ]
            }
          ]
        }
      }
    ];
  }

  function renderArmyPresetLibrary() {
    return armyPresetSections
      .map((section) => {
        const items = armyPresets.filter((preset) => preset.sectionId === section.id);
        if (!items.length) {
          return "";
        }

        return `
          <section class="army-preset-section" aria-labelledby="preset-section-${escapeAttribute(section.id)}">
            <div class="army-preset-section-header">
              <div>
                <p class="panel-kicker">Тип столкновения</p>
                <h3 id="preset-section-${escapeAttribute(section.id)}">${escapeHtml(section.label)}</h3>
              </div>
              <span class="meta-chip">${escapeHtml(section.pointsLabel)}</span>
            </div>
            <p class="reference-text army-preset-section-copy">${escapeHtml(section.description)}</p>
            <div class="army-preset-section-grid">
              ${items.map(renderArmyPresetCard).join("")}
            </div>
          </section>
        `;
      })
      .join("");
  }

  function createPresetArmy(configuration) {
    const army = createArmy("preset", configuration.name || "Армия");
    army.name = configuration.name || army.name;
    army.objective = configuration.objective || "";
    army.battalias = (configuration.battalias || []).map(createPresetBattalia);
    return army;
  }

  function loadArmyPreset(presetId, armyId) {
    const preset = armyPresets.find((item) => item.id === presetId);
    if (!preset) {
      return false;
    }

    const targetArmy = state.armies[armyId];
    if (targetArmy.battalias.length && !window.confirm(`Заменить текущий состав армии «${targetArmy.name}» на «${preset.name}»?`)) {
      return false;
    }

    const nextArmy = createPresetArmy(preset.army);
    state.armies[armyId].name = nextArmy.name;
    state.armies[armyId].objective = nextArmy.objective;
    state.armies[armyId].battalias = nextArmy.battalias;
    closeUtilityMenu("army-library-panel");
    renderAll();
    setActiveTab("armies");
    return true;
  }

  function closeUtilityMenu(target) {
    const menu = typeof target === "string"
      ? document.getElementById(target)
      : target;
    if (menu instanceof HTMLDetailsElement) {
      menu.removeAttribute("open");
    }
  }

  function closeClosestUtilityMenu(trigger) {
    closeUtilityMenu(trigger?.closest(".utility-menu-inline"));
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch (error) {
      return null;
    }
  }

  function sanitizeState(candidate) {
    const fresh = createDefaultState();
    if (!candidate || typeof candidate !== "object") {
      return fresh;
    }

    fresh.turn = Math.max(1, Number(candidate.turn) || 1);
    fresh.activePhaseIndex = Math.max(0, Math.min(data.phaseBlueprints.length - 1, Number(candidate.activePhaseIndex) || 0));
    fresh.armyView = candidate.armyView === "game" ? "game" : "solo";
    fresh.soloArmyId = candidate.soloArmyId === "red" ? "red" : "blue";
    fresh.globalNotes = String(candidate.globalNotes || "");

    ["blue", "red"].forEach((armyId) => {
      const army = candidate.armies && candidate.armies[armyId];
      if (!army) {
        return;
      }

      fresh.armies[armyId].name = translateLegacyText(String(army.name || fresh.armies[armyId].name));
      fresh.armies[armyId].objective = translateLegacyText(String(army.objective || ""));
      fresh.armies[armyId].battalias = Array.isArray(army.battalias)
        ? army.battalias.map((battalia) => ({
            id: battalia.id || uid("battalia"),
            name: translateLegacyText(String(battalia.name || "Баталия")),
            commander: translateLegacyText(String(battalia.commander || "")),
            commandRating: Math.max(5, Math.min(10, Number(battalia.commandRating) || 8)),
            type: battalia.type || "foot",
            notes: translateLegacyText(String(battalia.notes || "")),
            units: Array.isArray(battalia.units)
              ? battalia.units.map((unit) => {
                  const nextUnit = {
                    id: unit.id || uid("unit"),
                    templateId: unit.templateId || "custom",
                    name: translateLegacyText(String(unit.name || "Юнит")),
                    category: unit.category || "foot",
                    formation: unit.formation || "battle-line",
                    armament: translateLegacyText(String(unit.armament || "")),
                    move: String(unit.move || ""),
                    shoot: String(unit.shoot || ""),
                    range: String(unit.range || ""),
                    melee: String(unit.melee || ""),
                    morale: String(unit.morale || ""),
                    stamina: Math.max(1, Number(unit.stamina) || 3),
                    artKey: String(unit.artKey || ""),
                    pointsOverride: Number.isFinite(Number(unit.pointsOverride)) ? Number(unit.pointsOverride) : null,
                    pointsShootValue: Number.isFinite(Number(unit.pointsShootValue)) ? Number(unit.pointsShootValue) : null,
                    pointsUnavailable: Boolean(unit.pointsUnavailable),
                    specialRules: localizeSpecialRuleList(String(unit.specialRules || "")),
                    notes: translateLegacyText(String(unit.notes || "")),
                    casualties: Math.max(0, Number(unit.casualties) || 0),
                    disordered: Boolean(unit.disordered),
                    activated: Boolean(unit.activated),
                    reactionUsed: Boolean(unit.reactionUsed),
                    combatRole: unit.combatRole || "free",
                    lossState: unit.lossState || "active"
                  };
                  syncUnitTemplateMetadata(nextUnit);
                  return nextUnit;
                })
              : []
          }))
        : [];
    });

    return fresh;
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      return;
    }
  }

  function renderAll() {
    renderStatus();
    renderPhaseTracker();
    renderQuickTables();
    renderArmies();
    renderReference();
    renderUnits();
    saveState();
  }

  function renderStatus() {
    if (!refs.statusTurn || !refs.statusSide || !refs.statusPhase) {
      return;
    }
    const phase = getCurrentPhase();
    refs.statusTurn.textContent = String(state.turn);
    refs.statusSide.textContent = state.armies[phase.armyId].name;
    refs.statusPhase.textContent = phase.phaseLabel;
  }

  function renderPhaseTracker() {
    const current = getCurrentPhase();
    refs.phaseStrip.innerHTML = data.phaseBlueprints
      .map((phase, index) => {
        const armyName = escapeHtml(state.armies[phase.armyId].name);
        const activeClass = index === state.activePhaseIndex ? "is-active" : "";
        const teamClass = phase.armyId === "red" ? "phase-chip-red" : "phase-chip-blue";
        return `
          <div class="phase-chip ${teamClass} ${activeClass}">
            <small>Ход ${state.turn}</small>
            <strong>${armyName}</strong>
            <span>${escapeHtml(phase.phaseLabel)}</span>
          </div>
        `;
      })
      .join("");

    if (refs.phaseHelpGrid) {
      const relevantPhases = data.phaseBlueprints.filter((phase) => phase.armyId === current.armyId);
      const armyName = state.armies[current.armyId].name;

      refs.phaseHelpGrid.innerHTML = relevantPhases
        .map((phase) => {
          const isCurrent = phase.id === current.id;
          const sideClass = phase.armyId === "red" ? "phase-help-red" : "phase-help-blue";
          return `
            <article class="phase-help-card ${sideClass} ${isCurrent ? "is-active" : ""}">
              <div class="phase-help-header">
                <div>
                  <p class="phase-help-side">${escapeHtml(armyName)}</p>
                  <h3>${escapeHtml(phase.phaseLabel)}</h3>
                </div>
                ${isCurrent ? `<span class="phase-help-badge">Текущая</span>` : ""}
              </div>
              <p class="phase-help-summary">${escapeHtml(phase.summary)}</p>
              <ul class="phase-help-list">
                ${phase.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
          `;
        })
        .join("");
    }
  }

  function renderQuickTables() {
    refs.quickTables.innerHTML = data.quickTables
      .map(
        (table) => `
          <article class="quick-table-card">
            <h3>${escapeHtml(table.title)}</h3>
            <p class="footnote">${escapeHtml(table.source)}</p>
            <table class="data-table">
              <thead>
                <tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${table.rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row[0])}</td>
                        <td>${escapeHtml(row[1])}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </article>
        `
      )
      .join("");
  }

  function renderArmies() {
    const isGameView = state.armyView === "game";
    const isSoloView = state.armyView === "solo";
    const isEditableView = !isGameView;
    const libraryPanel = document.getElementById("army-library-panel");
    const sessionPanel = document.getElementById("army-session-panel");
    const soloArmySwitch = document.getElementById("solo-army-switch");
    const workspaceKicker = document.getElementById("army-workspace-kicker");
    const workspaceTitle = document.getElementById("army-workspace-title");

    if (libraryPanel) {
      libraryPanel.hidden = isGameView;
      if (isGameView) {
        libraryPanel.removeAttribute("open");
      }
    }
    if (sessionPanel) {
      sessionPanel.hidden = false;
    }
    if (soloArmySwitch) {
      soloArmySwitch.hidden = !isSoloView;
    }

    if (workspaceKicker) {
      workspaceKicker.textContent = isGameView
        ? "Игровой стол"
        : "Армибилдер";
    }

    if (workspaceTitle) {
      workspaceTitle.textContent = isGameView
        ? "Игровые статусы, потери и состояние баталий"
        : "Одна армия, её баталии и характеристики отрядов";
    }

    document.querySelectorAll(".armies-mode-button").forEach((button) => {
      const isActive = button.dataset.armyView === state.armyView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    document.querySelectorAll(".solo-army-button").forEach((button) => {
      const isActive = button.dataset.armyId === state.soloArmyId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (refs.armyDemoGrid) {
      refs.armyDemoGrid.innerHTML = isGameView ? "" : renderArmyPresetLibrary();
    }

    const armyIds = isSoloView ? [state.soloArmyId] : ["blue", "red"];
    refs.armiesGrid.classList.toggle("is-solo-view", isSoloView);
    refs.armiesGrid.innerHTML = armyIds
      .map((armyId) => renderArmyShell(armyId, isEditableView))
      .join("");
  }

  function renderArmyPresetCard(preset) {
    const points = getArmyPoints(createPresetArmy(preset.army));
    const isSoloView = state.armyView === "solo";
    const targetArmyId = isSoloView ? state.soloArmyId : null;
    const inlineStyle = [
      preset.art ? `--preset-art: url('${escapeAttribute(preset.art)}')` : "",
      preset.artPosition ? `--preset-art-position: ${escapeAttribute(preset.artPosition)}` : ""
    ].filter(Boolean).join("; ");
    return `
      <article class="demo-card army-preset-card ${preset.art ? "has-art" : ""}" ${inlineStyle ? `style="${inlineStyle}"` : ""}>
        <div class="army-preset-copy">
          <p class="panel-kicker">${escapeHtml(preset.theatre)}</p>
          <h3>${escapeHtml(preset.name)}</h3>
          <p class="reference-text">${escapeHtml(preset.summary)}</p>
        </div>
        <div class="preset-meta">
          <span class="meta-chip">${escapeHtml(formatPointsValue(points))}</span>
        </div>
        <div class="preset-actions">
          ${isSoloView ? `
            <button class="button ${targetArmyId === "red" ? "primary" : "ghost"}" type="button" data-action="load-army-preset" data-preset-id="${escapeAttribute(preset.id)}" data-army-id="${targetArmyId}">
              Загрузить в выбранную армию
            </button>
          ` : `
            <button class="button ghost" type="button" data-action="load-army-preset" data-preset-id="${escapeAttribute(preset.id)}" data-army-id="blue">
              В синюю армию
            </button>
            <button class="button primary" type="button" data-action="load-army-preset" data-preset-id="${escapeAttribute(preset.id)}" data-army-id="red">
              В красную армию
            </button>
          `}
        </div>
      </article>
    `;
  }

  function renderArmyShell(armyId, isBuilderView) {
    const army = state.armies[armyId];
    const metrics = getArmyMetrics(army);
    const totalUnits = army.battalias.reduce((sum, battalia) => sum + battalia.units.length, 0);

    return `
      <section class="army-shell ${armyId === "blue" ? "blue" : "red"} ${isBuilderView ? "builder-view" : "game-view"}">
        <div class="army-header">
          <div class="army-title-row">
            <span class="army-dot ${armyId === "blue" ? "blue" : "red"}"></span>
            ${isBuilderView ? `
              <input
                class="army-name-input"
                type="text"
                value="${escapeAttribute(army.name)}"
                data-army-name-input="${armyId}"
                aria-label="Название армии"
              >
            ` : `
              <h3 class="army-name-heading">${escapeHtml(army.name)}</h3>
            `}
          </div>
          <div class="battalia-actions">
            ${isBuilderView ? `
              <button class="inline-button primary" data-action="add-battalia" data-army-id="${armyId}">
                Добавить баталию
              </button>
            ` : `
              <button class="inline-button ghost" data-action="clear-flags" data-army-id="${armyId}">
                Очистить метки хода
              </button>
            `}
          </div>
        </div>

        <div class="army-metrics">
          <div class="metric-box is-points">
            <span>Стоимость армии</span>
            <strong>${escapeHtml(formatPointsValue(metrics.points))}</strong>
          </div>
          <div class="metric-box">
            <span>Баталии</span>
            <strong>${metrics.totalBattalias}</strong>
          </div>
          <div class="metric-box">
            <span>Всего юнитов</span>
            <strong>${totalUnits}</strong>
          </div>
          ${isBuilderView ? "" : `
            <div class="metric-box">
              <span>Сломлены</span>
              <strong>${metrics.brokenCount}</strong>
            </div>
            <div class="metric-box">
              <span>Потери</span>
              <strong>${metrics.lostUnits}</strong>
            </div>
            <div class="metric-box">
              <span>Состояние армии</span>
              <strong>${metrics.armyBroken ? "Рухнула" : "Удерживает строй"}</strong>
            </div>
          `}
        </div>

        ${army.objective ? `<p class="army-objective"><strong>Задача:</strong> ${escapeHtml(army.objective)}</p>` : ""}

        <div class="battalia-list">
          ${army.battalias.length ? army.battalias.map((battalia) => renderBattalia(armyId, battalia)).join("") : renderEmptyBattalia()}
        </div>
      </section>
    `;
  }

  function renderReference() {
    const query = refs.referenceSearch.value.trim().toLowerCase();
    const items = data.referenceSections.filter((section) => matchesReference(section, query));

    refs.referenceGrid.innerHTML = items
      .map(
        (section) => `
          <article class="reference-card">
            <h3>${escapeHtml(section.title)}</h3>
            <p class="footnote">${escapeHtml(section.source)}</p>
            <ul>
              ${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          </article>
        `
      )
      .join("");
  }

  function renderUnits() {
    const archetypeQuery = refs.unitSearch.value.trim().toLowerCase();
    const ruleQuery = refs.specialRuleSearch.value.trim().toLowerCase();

    const archetypes = data.unitArchetypes.filter((item) => {
      if (!archetypeQuery) {
        return true;
      }
      const haystack = `${item.title} ${item.tags.join(" ")} ${(item.keywords || []).join(" ")} ${item.summary} ${item.strengths.join(" ")} ${item.limits.join(" ")} ${item.reminders}`.toLowerCase();
      return haystack.includes(archetypeQuery);
    });

    const specialRules = data.specialRules.filter((rule) => {
      if (!ruleQuery) {
        return true;
      }
      return `${rule.name} ${rule.originalName || ""} ${(rule.aliases || []).join(" ")} ${rule.summary} ${rule.source}`.toLowerCase().includes(ruleQuery);
    });

    refs.archetypeGrid.innerHTML = archetypes
      .map(
        (item) => `
          <article class="reference-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p class="footnote">${escapeHtml(item.source)}</p>
            <div class="chip-row">${item.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
            <p class="reference-text">${escapeHtml(item.summary)}</p>
            <ul>
              ${item.strengths.map((strength) => `<li>${escapeHtml(strength)}</li>`).join("")}
              ${item.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("")}
            </ul>
            <div class="reference-footer">
              <span class="badge good">${escapeHtml(item.reminders)}</span>
            </div>
          </article>
        `
      )
      .join("");

    refs.specialRuleGrid.innerHTML = specialRules
      .map(
        (rule) => `
          <article class="rule-card">
            <h3>${escapeHtml(rule.name)}</h3>
            <p class="footnote">${escapeHtml(rule.source)}</p>
            <p class="reference-text">${escapeHtml(rule.summary)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderBattalia(armyId, battalia) {
    const metrics = getBattaliaMetrics(battalia);
    const commanderPoints = getCommanderPoints(battalia.commandRating);
    const isBuilderView = state.armyView !== "game";
    return `
      <article class="battalia-card ${metrics.broken ? "is-broken" : ""}">
        <div class="panel-header">
          <div>
            <h3>${escapeHtml(battalia.name)}</h3>
            <p class="reference-text">
              Командир: ${escapeHtml(battalia.commander || "не указан")} · Рейтинг командования ${battalia.commandRating}
            </p>
          </div>
          ${isBuilderView ? `
            <div class="battalia-actions">
              <button class="inline-button ghost" data-action="edit-battalia" data-army-id="${armyId}" data-battalia-id="${battalia.id}">
                Изменить
              </button>
              <button class="inline-button ghost" data-action="add-unit" data-army-id="${armyId}" data-battalia-id="${battalia.id}">
                Добавить юнит
              </button>
              <button class="inline-button danger" data-action="delete-battalia" data-army-id="${armyId}" data-battalia-id="${battalia.id}">
                Удалить
              </button>
            </div>
          ` : ""}
        </div>

        <div class="battalia-meta">
          <span class="meta-chip">${escapeHtml(formatBattaliaType(battalia.type))}</span>
          <span class="meta-chip">Стоимость: ${escapeHtml(formatPointsValue(metrics.points))}</span>
          <span class="meta-chip">Командир: ${escapeHtml(formatPointsValue(commanderPoints))}</span>
          <span class="meta-chip">Всего юнитов: ${battalia.units.length}</span>
          ${isBuilderView ? "" : `
            <span class="meta-chip ${metrics.broken ? "breaking" : "steady"}">
              ${metrics.broken ? "Баталия сломлена" : "Баталия держится"}
            </span>
            <span class="meta-chip">Потери для слома: ${metrics.lostCount}/${metrics.relevantCount || 0}</span>
          `}
        </div>

        ${battalia.notes ? `<p class="reference-text">${escapeHtml(battalia.notes)}</p>` : ""}

        <div class="unit-list">
          ${battalia.units.length ? battalia.units.map((unit) => renderUnit(armyId, battalia.id, unit)).join("") : `
            <div class="unit-card">
              <p class="soft-text">Пока нет юнитов. Добавь пехоту, конницу, драгун или артиллерию, чтобы начать отслеживание.</p>
            </div>
          `}
        </div>
      </article>
    `;
  }

  function renderUnit(armyId, battaliaId, unit) {
    const derived = getUnitDerived(unit);
    const warnings = getUnitWarnings(unit, derived);
    const points = getUnitPoints(unit);
    const artStyle = buildUnitCardStyle(unit);
    const isBuilderView = state.armyView !== "game";
    const trimmedButton = derived.excess > 0
      ? `<button class="inline-button ghost" data-action="trim-casualties" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">Сбросить сверхпотери</button>`
      : "";

    return `
      <article class="unit-card ${artStyle ? "has-art" : ""}"${artStyle ? ` style="${escapeAttribute(artStyle)}"` : ""}>
        <div class="unit-card-header">
          <div>
            <h4 class="unit-name">${escapeHtml(unit.name)}</h4>
            <p class="unit-subtitle">
              ${escapeHtml(formatCategory(unit.category))} · ${escapeHtml(formatFormation(unit.formation))} · ${escapeHtml(unit.armament || "Вооружение не указано")}
            </p>
          </div>
          ${isBuilderView ? `
            <div class="unit-actions">
              <button class="inline-button ghost" data-action="edit-unit" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">
                Изменить
              </button>
              <button class="inline-button danger" data-action="delete-unit" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">
                Удалить
              </button>
            </div>
          ` : ""}
        </div>

        ${isBuilderView ? "" : `
          <div class="unit-meta">
            <span class="meta-chip ${derived.shaken ? "breaking" : "steady"}">
              ${derived.shaken ? "Потрясён" : "В строю"}
            </span>
            <span class="meta-chip ${unit.disordered ? "breaking" : "steady"}">
              ${unit.disordered ? "Дезорганизован" : "В порядке"}
            </span>
            <span class="meta-chip">${escapeHtml(formatCombatRole(unit.combatRole))}</span>
            <span class="meta-chip">${escapeHtml(formatLossState(unit.lossState))}</span>
          </div>
        `}

        <div class="unit-stat-list">
          ${renderStat("Движение", unit.move || "-")}
          ${renderStat("Стрельба", unit.shoot || "-")}
          ${renderStat("Дальность", unit.range || "-")}
          ${renderStat("Рукопашная", unit.melee || "-")}
          ${renderStat("Мораль", unit.morale || "-")}
          ${renderStat("Стойкость", String(unit.stamina))}
          ${renderStat("Стоимость", formatPointsValue(points))}
        </div>

        ${isBuilderView ? "" : `
          <div class="unit-control-row">
            <div class="counter">
              <button class="icon-button" data-action="adjust-casualties" data-delta="-1" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}" aria-label="Уменьшить потери">−</button>
              <strong>Потери: ${unit.casualties}${derived.excess > 0 ? ` (+${derived.excess})` : ""}</strong>
              <button class="icon-button" data-action="adjust-casualties" data-delta="1" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}" aria-label="Увеличить потери">+</button>
            </div>
            ${trimmedButton}
          </div>

          <div class="control-group">
            <button class="toggle-button ${unit.disordered ? "is-active" : ""}" data-action="toggle-flag" data-flag="disordered" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">
              Дезорганизация
            </button>
            <button class="toggle-button ${unit.activated ? "is-active" : ""}" data-action="toggle-flag" data-flag="activated" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">
              Активирован
            </button>
            <button class="toggle-button ${unit.reactionUsed ? "is-active" : ""}" data-action="toggle-flag" data-flag="reactionUsed" data-army-id="${armyId}" data-battalia-id="${battaliaId}" data-unit-id="${unit.id}">
              Реакция использована
            </button>
          </div>

          <div class="combat-role-switch">
            ${renderSwitchButton("combat-role", "free", "Свободен", unit.combatRole === "free", armyId, battaliaId, unit.id)}
            ${renderSwitchButton("combat-role", "engaged", "В бою", unit.combatRole === "engaged", armyId, battaliaId, unit.id)}
            ${renderSwitchButton("combat-role", "supporting", "Поддержка", unit.combatRole === "supporting", armyId, battaliaId, unit.id)}
          </div>

          <div class="loss-switch">
            ${renderSwitchButton("loss-state", "active", "На столе", unit.lossState === "active", armyId, battaliaId, unit.id)}
            ${renderSwitchButton("loss-state", "off-table", "Вышел", unit.lossState === "off-table", armyId, battaliaId, unit.id)}
            ${renderSwitchButton("loss-state", "destroyed", "Уничтожен", unit.lossState === "destroyed", armyId, battaliaId, unit.id)}
          </div>
        `}

        ${unit.specialRules ? `<div class="chip-row">${splitSpecialRules(unit.specialRules).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        ${isBuilderView ? "" : warnings.length ? `<div class="warning-list">${warnings.map((item) => `<span class="badge ${item.level}">${escapeHtml(item.text)}</span>`).join("")}</div>` : ""}
        ${unit.notes ? `<p class="reference-text">${escapeHtml(unit.notes)}</p>` : ""}
      </article>
    `;
  }

  function handleArmyGridClick(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }

    const action = trigger.dataset.action;
    if (action === "set-army-view") {
      const nextView = trigger.dataset.armyView;
      state.armyView = nextView === "game" ? "game" : "solo";
      renderArmies();
      saveState();
      return;
    }

    if (action === "set-solo-army") {
      state.soloArmyId = trigger.dataset.armyId === "red" ? "red" : "blue";
      renderArmies();
      saveState();
      return;
    }

    if (action === "load-army-preset") {
      loadArmyPreset(trigger.dataset.presetId, trigger.dataset.armyId);
      return;
    }

    if (action === "load-demo-preset") {
      loadDemoPreset(trigger.dataset.presetId);
      return;
    }

    const armyId = trigger.dataset.armyId;
    const battaliaId = trigger.dataset.battaliaId;
    const unitId = trigger.dataset.unitId;

    if (action === "add-battalia") {
      openBattaliaDialog(armyId);
      return;
    }

    if (action === "edit-battalia") {
      openBattaliaDialog(armyId, battaliaId);
      return;
    }

    if (action === "delete-battalia") {
      if (window.confirm("Удалить баталию вместе со всеми её юнитами?")) {
        const army = state.armies[armyId];
        army.battalias = army.battalias.filter((battalia) => battalia.id !== battaliaId);
        renderAll();
      }
      return;
    }

    if (action === "add-unit") {
      openUnitDialog(armyId, battaliaId);
      return;
    }

    if (action === "edit-unit") {
      openUnitDialog(armyId, battaliaId, unitId);
      return;
    }

    if (action === "delete-unit") {
      if (window.confirm("Удалить юнит из баталии?")) {
        const battalia = findBattalia(armyId, battaliaId);
        battalia.units = battalia.units.filter((unit) => unit.id !== unitId);
        renderAll();
      }
      return;
    }

    if (action === "adjust-casualties") {
      const unit = findUnit(armyId, battaliaId, unitId);
      unit.casualties = Math.max(0, unit.casualties + Number(trigger.dataset.delta));
      renderAll();
      return;
    }

    if (action === "trim-casualties") {
      const unit = findUnit(armyId, battaliaId, unitId);
      unit.casualties = Math.min(unit.casualties, Number(unit.stamina) || 0);
      renderAll();
      return;
    }

    if (action === "toggle-flag") {
      const unit = findUnit(armyId, battaliaId, unitId);
      const flag = trigger.dataset.flag;
      unit[flag] = !unit[flag];
      renderAll();
      return;
    }

    if (action === "combat-role") {
      const unit = findUnit(armyId, battaliaId, unitId);
      unit.combatRole = trigger.dataset.value;
      renderAll();
      return;
    }

    if (action === "loss-state") {
      const unit = findUnit(armyId, battaliaId, unitId);
      unit.lossState = trigger.dataset.value;
      renderAll();
      return;
    }

    if (action === "clear-flags") {
      state.armies[armyId].battalias.forEach((battalia) => {
        battalia.units.forEach((unit) => {
          unit.activated = false;
          unit.reactionUsed = false;
        });
      });
      renderAll();
    }
  }

  function handleArmyGridInput(event) {
    const armyNameInput = event.target.closest("[data-army-name-input]");
    if (armyNameInput) {
      const armyId = armyNameInput.dataset.armyNameInput;
      state.armies[armyId].name = armyNameInput.value || (armyId === "blue" ? "Синяя армия" : "Красная армия");
      renderStatus();
      renderPhaseTracker();
      saveState();
    }
  }

  function openBattaliaDialog(armyId, battaliaId) {
    const title = document.getElementById("battalia-dialog-title");
    const idField = document.getElementById("battalia-id");
    const armyField = document.getElementById("battalia-army-id");
    const nameField = document.getElementById("battalia-name");
    const commanderField = document.getElementById("battalia-commander");
    const ratingField = document.getElementById("battalia-rating");
    const typeField = document.getElementById("battalia-type");
    const notesField = document.getElementById("battalia-notes");

    armyField.value = armyId;

    if (!battaliaId) {
      title.textContent = "Новая баталия";
      idField.value = "";
      nameField.value = "";
      commanderField.value = "";
      ratingField.value = "8";
      typeField.value = "foot";
      notesField.value = "";
    } else {
      const battalia = findBattalia(armyId, battaliaId);
      title.textContent = "Редактировать баталию";
      idField.value = battalia.id;
      nameField.value = battalia.name;
      commanderField.value = battalia.commander;
      ratingField.value = String(battalia.commandRating);
      typeField.value = battalia.type;
      notesField.value = battalia.notes;
    }

    refs.battaliaDialog.showModal();
  }

  function handleBattaliaSubmit(event) {
    event.preventDefault();
    const armyId = document.getElementById("battalia-army-id").value;
    const battaliaId = document.getElementById("battalia-id").value;
    const values = {
      name: document.getElementById("battalia-name").value.trim(),
      commander: document.getElementById("battalia-commander").value.trim(),
      commandRating: Number(document.getElementById("battalia-rating").value),
      type: document.getElementById("battalia-type").value,
      notes: document.getElementById("battalia-notes").value.trim()
    };

    const army = state.armies[armyId];
    if (!battaliaId) {
      army.battalias.push(createBattalia(values));
    } else {
      const battalia = findBattalia(armyId, battaliaId);
      battalia.name = values.name || battalia.name;
      battalia.commander = values.commander;
      battalia.commandRating = Math.max(5, Math.min(10, values.commandRating || 8));
      battalia.type = values.type;
      battalia.notes = values.notes;
    }

    refs.battaliaDialog.close();
    renderAll();
  }

  function openUnitDialog(armyId, battaliaId, unitId) {
    const title = document.getElementById("unit-dialog-title");
    const armyField = document.getElementById("unit-army-id");
    const battaliaField = document.getElementById("unit-battalia-id");
    const idField = document.getElementById("unit-id");

    armyField.value = armyId;
    battaliaField.value = battaliaId;

    if (!unitId) {
      title.textContent = "Новый юнит";
      applyUnitToForm(createUnitFromTemplate("custom", ""));
      document.getElementById("unit-name").value = "";
      idField.value = "";
    } else {
      const unit = findUnit(armyId, battaliaId, unitId);
      title.textContent = "Редактировать юнит";
      applyUnitToForm(unit);
      idField.value = unit.id;
    }

    refs.unitDialog.showModal();
  }

  function applyUnitToForm(unit) {
    document.getElementById("unit-template").value = unit.templateId || "custom";
    document.getElementById("unit-name").value = unit.name || "";
    document.getElementById("unit-category").value = unit.category || "foot";
    document.getElementById("unit-formation").value = unit.formation || "battle-line";
    document.getElementById("unit-armament").value = unit.armament || "";
    document.getElementById("unit-move").value = unit.move || "";
    document.getElementById("unit-shoot").value = unit.shoot || "";
    document.getElementById("unit-range").value = unit.range || "";
    document.getElementById("unit-melee").value = unit.melee || "";
    document.getElementById("unit-morale").value = unit.morale || "";
    document.getElementById("unit-stamina").value = String(unit.stamina || 3);
    document.getElementById("unit-special-rules").value = unit.specialRules || "";
    document.getElementById("unit-notes").value = unit.notes || "";
  }

  function handleUnitSubmit(event) {
    event.preventDefault();
    const armyId = document.getElementById("unit-army-id").value;
    const battaliaId = document.getElementById("unit-battalia-id").value;
    const unitId = document.getElementById("unit-id").value;

    const values = {
      templateId: document.getElementById("unit-template").value,
      name: document.getElementById("unit-name").value.trim() || "Юнит",
      category: document.getElementById("unit-category").value,
      formation: document.getElementById("unit-formation").value,
      armament: document.getElementById("unit-armament").value.trim(),
      move: document.getElementById("unit-move").value.trim(),
      shoot: document.getElementById("unit-shoot").value.trim(),
      range: document.getElementById("unit-range").value.trim(),
      melee: document.getElementById("unit-melee").value.trim(),
      morale: document.getElementById("unit-morale").value.trim(),
      stamina: Math.max(1, Number(document.getElementById("unit-stamina").value) || 3),
      specialRules: document.getElementById("unit-special-rules").value.trim(),
      notes: document.getElementById("unit-notes").value.trim()
    };

    const battalia = findBattalia(armyId, battaliaId);

    if (!unitId) {
      const nextUnit = createUnitFromTemplate(values.templateId || "custom", values.name);
      Object.assign(nextUnit, values);
      syncUnitTemplateMetadata(nextUnit);
      battalia.units.push(nextUnit);
    } else {
      const unit = findUnit(armyId, battaliaId, unitId);
      Object.assign(unit, values);
      syncUnitTemplateMetadata(unit);
    }

    refs.unitDialog.close();
    renderAll();
  }

  function handleTemplateChange() {
    const template = getTemplateById(refs.unitTemplate.value);
    if (!template || template.id === "custom") {
      return;
    }

    const currentName = document.getElementById("unit-name").value.trim();
    applyUnitToForm({
      ...template,
      name: currentName || template.name
    });
  }

  function renderTemplateOptions() {
    refs.unitTemplate.innerHTML = data.unitTemplates
      .map((template) => `<option value="${escapeAttribute(template.id)}">${escapeHtml(template.name)}</option>`)
      .join("");
  }

  function stepPhase(delta) {
    const count = data.phaseBlueprints.length;
    let nextIndex = state.activePhaseIndex + delta;

    if (nextIndex < 0) {
      nextIndex = count - 1;
      state.turn = Math.max(1, state.turn - 1);
    } else if (nextIndex >= count) {
      nextIndex = 0;
      state.turn += 1;
    }

    state.activePhaseIndex = nextIndex;
    renderAll();
  }

  function setActiveTab(tabId) {
    document.querySelectorAll(".tab").forEach((button) => {
      const isActive = button.dataset.tabTarget === tabId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === tabId);
    });
  }

  function exportState() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pike-shotte-sostoyanie-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleImportFile(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = sanitizeState(JSON.parse(String(reader.result || "{}")));
        renderAll();
      } catch (error) {
        window.alert("Не удалось импортировать файл состояния.");
      } finally {
        refs.importFileInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function resetState() {
    if (!window.confirm("Сбросить приложение и очистить текущее состояние партии?")) {
      return false;
    }

    state = createDefaultState();
    renderAll();
    return true;
  }
  function getCurrentPhase() {
    return data.phaseBlueprints[state.activePhaseIndex];
  }

  function getArmyPoints(army) {
    return combinePointResults((army.battalias || []).map((battalia) => getBattaliaPoints(battalia)));
  }

  function getBattaliaPoints(battalia) {
    return combinePointResults([
      getCommanderPoints(battalia.commandRating),
      ...(battalia.units || []).map((unit) => getUnitPoints(unit))
    ]);
  }

  function getCommanderPoints(commandRating) {
    const rating = Math.max(5, Math.min(10, Number(commandRating) || 0));
    const table = { 6: 10, 7: 20, 8: 40, 9: 60, 10: 80 };
    if (!table[rating]) {
      return buildPointResult(0, {
        incomplete: true,
        notes: [`Рейтинг командования ${rating} не имеет стандартной цены в рульбуке.`]
      });
    }
    return buildPointResult(table[rating], {
      official: true,
      notes: [`Командир ${rating}: официальная цена по рульбуку.`]
    });
  }

  function getUnitPoints(unit) {
    if (unit.pointsUnavailable || unit.category === "baggage") {
      return buildPointResult(0, {
        scenario: true,
        notes: ["Сценарный юнит: базовая стоимость в рульбуке не указана."]
      });
    }

    const explicitPoints = Number.isFinite(Number(unit.pointsOverride)) ? Number(unit.pointsOverride) : null;
    if (explicitPoints !== null) {
      return buildPointResult(explicitPoints, {
        official: true,
        notes: ["Официальная стоимость профиля по рульбуку."]
      });
    }

    let value = getComputedUnitBasePoints(unit);
    let incomplete = false;
    const notes = ["Расчёт по системе очков из рульбука."];
    const unsupportedRules = [];

    splitSpecialRules(unit.specialRules || "").forEach((ruleName) => {
      const modifier = getSpecialRulePointModifier(ruleName, unit);
      if (!modifier.supported) {
        unsupportedRules.push(ruleName);
        incomplete = true;
        return;
      }
      value += modifier.value;
    });

    if (unsupportedRules.length) {
      notes.push(`Неучтённые правила: ${unsupportedRules.join(", ")}.`);
    }

    return buildPointResult(Math.max(0, Math.round(value)), {
      estimated: true,
      incomplete,
      notes
    });
  }

  function buildPointResult(value, options = {}) {
    return {
      value: Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0,
      official: Boolean(options.official),
      estimated: Boolean(options.estimated),
      scenario: Boolean(options.scenario),
      incomplete: Boolean(options.incomplete),
      notes: Array.isArray(options.notes) ? options.notes.filter(Boolean) : []
    };
  }

  function combinePointResults(results) {
    const items = results.filter(Boolean);
    const seenNotes = new Set();
    const notes = [];

    items.forEach((item) => {
      (item.notes || []).forEach((note) => {
        if (note && !seenNotes.has(note)) {
          seenNotes.add(note);
          notes.push(note);
        }
      });
    });

    return buildPointResult(
      items.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
      {
        official: items.length > 0 && items.every((item) => item.official && !item.estimated && !item.scenario && !item.incomplete),
        estimated: items.some((item) => item.estimated),
        scenario: items.some((item) => item.scenario),
        incomplete: items.some((item) => item.incomplete),
        notes
      }
    );
  }

  function getComputedUnitBasePoints(unit) {
    const isArtillery = unit.category === "artillery";
    const isHorse = unit.category === "horse";
    const handFactor = isHorse ? 2 : 1;
    const moraleFactor = isArtillery ? 2 : 4;
    const staminaFactor = isArtillery ? 2 : 4;
    const handValue = parsePrimaryNumber(unit.melee);
    const shootValue = getPointShootValue(unit);
    const rangeBand = getRangeBand(unit.range);
    const moralePips = getMoralePips(unit.morale);
    const stamina = Math.max(1, Number(unit.stamina) || 1);
    return (handValue * handFactor) + (shootValue * getShootPointFactor(unit.category, rangeBand)) + (moralePips * moraleFactor) + (stamina * staminaFactor);
  }

  function getPointShootValue(unit) {
    if (Number.isFinite(Number(unit.pointsShootValue))) {
      return Number(unit.pointsShootValue);
    }
    const values = String(unit.shoot || "")
      .match(/\d+/g)?.map((value) => Number(value)) || [];
    if (!values.length) {
      return 0;
    }
    return unit.category === "artillery" && values.length > 1 ? Math.min(...values) : values[0];
  }

  function getShootPointFactor(category, rangeBand) {
    if (!rangeBand) {
      return 0;
    }

    if (category === "artillery") {
      if (rangeBand <= 12) {
        return 4;
      }
      if (rangeBand <= 24) {
        return 8;
      }
      if (rangeBand <= 36) {
        return 12;
      }
      if (rangeBand <= 48) {
        return 16;
      }
      return 20;
    }

    if (rangeBand <= 12) {
      return 1;
    }
    if (rangeBand <= 18) {
      return 2;
    }
    return 3;
  }

  function getRangeBand(value) {
    const numbers = String(value || "")
      .match(/\d+/g)?.map((item) => Number(item)) || [];
    return numbers.length ? Math.max(...numbers) : 0;
  }

  function getMoralePips(value) {
    const raw = parsePrimaryNumber(value);
    return raw ? Math.max(0, 7 - raw) : 0;
  }

  function parsePrimaryNumber(value) {
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function getSpecialRulePointModifier(ruleName, unit) {
    const hasRanged = getPointShootValue(unit) > 0 && getRangeBand(unit.range) > 0;

    if (matchesRule(ruleName, ["bad war", "плохая война", "dragoons", "драгуны", "caracole", "караколь", "hedgehog", "ёж", "pikes", "пики", "untested", "необстрелянные"])) {
      return { supported: true, value: 0 };
    }

    if (matchesRule(ruleName, ["brave", "храбрые"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["eager", "рвущиеся в бой"])) {
      return { supported: true, value: 3 };
    }
    if (matchesRule(ruleName, ["fanatics", "фанатики"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["ferocious charge", "яростная атака"])) {
      return { supported: true, value: unit.category === "horse" ? 5 : 3 };
    }
    if (matchesRule(ruleName, ["fire & evade", "огонь и отход"])) {
      return { supported: true, value: 2 };
    }
    if (matchesRule(ruleName, ["firelocks & flintlocks", "кремнёвые замки"])) {
      return { supported: true, value: 1 };
    }
    if (matchesRule(ruleName, ["first fire", "первый залп"])) {
      return { supported: true, value: 1 };
    }
    if (matchesRule(ruleName, ["freshly raised", "свеже набранные"])) {
      return { supported: true, value: -3 };
    }
    if (matchesRule(ruleName, ["galloper", "галоперы"])) {
      return { supported: true, value: -2 };
    }
    if (matchesRule(ruleName, ["grenades", "гранаты"])) {
      return { supported: true, value: 1 };
    }
    if (matchesRule(ruleName, ["heavy cavalry +d3", "тяжёлая конница +d3"])) {
      return { supported: true, value: 8 };
    }
    if (matchesRule(ruleName, ["heavy cavalry +1", "тяжёлая конница +1"])) {
      return { supported: true, value: 4 };
    }
    if (matchesRule(ruleName, ["lancers", "копейщики"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["large unit", "крупный юнит"])) {
      return { supported: true, value: hasRanged ? 8 : 6 };
    }
    if (matchesRule(ruleName, ["marauders", "мародёры"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["mercenary", "наёмники"])) {
      return { supported: true, value: -3 };
    }
    if (matchesRule(ruleName, ["militia", "ополчение"])) {
      return { supported: true, value: -3 };
    }
    if (matchesRule(ruleName, ["pike company", "пиковая рота"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["plug bayonet", "штык-затычка"])) {
      return { supported: true, value: 2 };
    }
    if (matchesRule(ruleName, ["rabble", "сброд"])) {
      return { supported: true, value: -5 };
    }
    if (matchesRule(ruleName, ["reliable", "надёжные"])) {
      return { supported: true, value: 4 };
    }
    if (matchesRule(ruleName, ["sharp shooters", "меткие стрелки"])) {
      return { supported: true, value: 3 };
    }
    if (matchesRule(ruleName, ["small unit", "малый юнит"])) {
      return { supported: true, value: hasRanged ? -8 : -6 };
    }
    if (matchesRule(ruleName, ["steady", "стойкие"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["stubborn", "упрямые"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["superbly drilled", "безупречно вымуштрованные"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["swordsmen", "мечники"])) {
      return { supported: true, value: 4 };
    }
    if (matchesRule(ruleName, ["terrifying charge", "ужасающая атака"])) {
      return { supported: true, value: 5 };
    }
    if (matchesRule(ruleName, ["tough fighters", "крепкие бойцы"])) {
      return { supported: true, value: unit.category === "horse" ? 2 : 1 };
    }
    if (matchesRule(ruleName, ["valiant", "доблестные"])) {
      return { supported: true, value: 3 };
    }
    if (matchesRule(ruleName, ["wavering", "колеблющиеся"])) {
      return { supported: true, value: -2 * Math.max(1, Number(unit.stamina) || 1) };
    }
    if (matchesRule(ruleName, ["crack", "ветераны"])) {
      return { supported: true, value: getMoralePips(unit.morale) };
    }

    return { supported: false, value: 0 };
  }

  function matchesRule(ruleName, patterns) {
    const normalized = normalizeText(ruleName);
    return patterns.some((pattern) => normalized === normalizeText(pattern) || normalized.includes(normalizeText(pattern)));
  }

  function formatPointsValue(result) {
    if (result.scenario && !result.value) {
      return "Без оценки";
    }
    if (!Number.isFinite(Number(result.value))) {
      return "Н/д";
    }
    return `${Math.round(Number(result.value) || 0)} pts`;
  }

  function getArmyMetrics(army) {
    const battaliaMetrics = army.battalias.map((battalia) => getBattaliaMetrics(battalia));
    const brokenCount = battaliaMetrics.filter((item) => item.broken).length;
    const totalBattalias = army.battalias.length;
    const lostUnits = battaliaMetrics.reduce((sum, item) => sum + item.allLost, 0);
    const points = getArmyPoints(army);
    return {
      brokenCount,
      totalBattalias,
      lostUnits,
      armyBroken: totalBattalias > 0 ? brokenCount * 2 >= totalBattalias : false,
      points
    };
  }

  function getBattaliaMetrics(battalia) {
    const units = battalia.units || [];
    const infantryCavalry = units.filter((unit) => unit.category === "foot" || unit.category === "horse");
    const artillery = units.filter((unit) => unit.category === "artillery");
    const relevantUnits = artillery.length > infantryCavalry.length
      ? units.filter((unit) => unit.category !== "baggage")
      : infantryCavalry;
    const lostCount = relevantUnits.filter((unit) => getUnitDerived(unit).lost).length;
    const allLost = units.filter((unit) => getUnitDerived(unit).lost).length;
    const points = getBattaliaPoints(battalia);
    return {
      broken: relevantUnits.length > 0 ? lostCount > relevantUnits.length / 2 : false,
      relevantCount: relevantUnits.length,
      lostCount,
      allLost,
      points
    };
  }

  function getUnitDerived(unit) {
    const stamina = Math.max(1, Number(unit.stamina) || 1);
    const casualties = Math.max(0, Number(unit.casualties) || 0);
    const shaken = casualties >= stamina;
    const excess = Math.max(0, casualties - stamina);
    const lost = unit.lossState !== "active" || shaken;
    return { stamina, casualties, shaken, excess, lost };
  }

  function getUnitWarnings(unit, derived) {
    const warnings = [];

    if (unit.lossState === "destroyed") {
      warnings.push({ level: "critical", text: "Уничтожен: юнит полностью потерян." });
    } else if (unit.lossState === "off-table") {
      warnings.push({ level: "critical", text: "Вне стола: считается потерянным для слома баталии." });
    }

    if (derived.shaken) {
      warnings.push({ level: "critical", text: "Потрясён (Shaken): не атакует и не контратакует; -1 к стрельбе и рукопашной." });
    }

    if (derived.excess > 0) {
      warnings.push({ level: "critical", text: `Сверхпотери ${derived.excess}: нужен тест на слом.` });
    }

    if (unit.disordered) {
      warnings.push({ level: "warning", text: "Дезорганизован (Disordered): без приказов; -1 к стрельбе, рукопашной и тестам на слом; по инициативе обычно только отход." });
    }

    if (unit.combatRole === "engaged") {
      warnings.push({ level: "warning", text: "В бою: не получает приказов и не действует по инициативе, пока схватка не завершится." });
    }

    if (unit.combatRole === "supporting") {
      warnings.push({ level: "warning", text: "Поддержка: юнит считается занятым поддержкой, пока схватка рядом не решена." });
    }

    if (unit.formation === "column") {
      warnings.push({ level: "warning", text: "Колонна (Column): не стреляет и не атакует, но может пройти свободный ход при провале приказа." });
    }

    if (unit.formation === "hedgehog") {
      warnings.push({ level: "good", text: "Ёж (Hedgehog): неподвижен, без флангов и тыла, получает +3 против конницы и держится очень упорно." });
    }

    if (unit.formation === "skirmish") {
      warnings.push({ level: "good", text: "Рассыпной строй (Skirmish): огонь на 360°, можно делить кубы, силён в местности, но слаб в рукопашной." });
    }

    if (unit.formation === "building") {
      warnings.push({ level: "good", text: "Здание (Building): +2 к морали, особая стрельба и бой по сторонам, внешняя поддержка не действует." });
    }

    return warnings;
  }

  function findBattalia(armyId, battaliaId) {
    return state.armies[armyId].battalias.find((battalia) => battalia.id === battaliaId);
  }

  function findUnit(armyId, battaliaId, unitId) {
    return findBattalia(armyId, battaliaId).units.find((unit) => unit.id === unitId);
  }

  function getTemplateById(templateId) {
    return data.unitTemplates.find((template) => template.id === templateId) || data.unitTemplates[0];
  }

  function matchesReference(section, query) {
    if (!query) {
      return true;
    }

    const haystack = `${section.title} ${section.source} ${section.keywords.join(" ")} ${section.bullets.join(" ")}`.toLowerCase();
    return haystack.includes(query);
  }

  function renderStat(label, value) {
    return `
      <div class="stat-pill">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderSwitchButton(action, value, label, isActive, armyId, battaliaId, unitId) {
    return `
      <button
        class="toggle-button ${isActive ? "is-active" : ""}"
        data-action="${action}"
        data-value="${value}"
        data-army-id="${armyId}"
        data-battalia-id="${battaliaId}"
        data-unit-id="${unitId}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function syncUnitTemplateMetadata(unit) {
    const template = getTemplateById(unit.templateId || "custom");
    const currentOverride = Number.isFinite(Number(unit.pointsOverride)) ? Number(unit.pointsOverride) : null;
    const currentShootValue = Number.isFinite(Number(unit.pointsShootValue)) ? Number(unit.pointsShootValue) : null;
    const matchesTemplate = template && template.id !== "custom" ? isTemplateProfileMatch(unit, template) : false;

    if (template && template.id !== "custom") {
      unit.artKey = template.artKey || detectUnitArtKey({ ...unit, artKey: "" });
      unit.pointsOverride = matchesTemplate && Number.isFinite(Number(template.pointsOverride)) ? Number(template.pointsOverride) : null;
      unit.pointsShootValue = Number.isFinite(Number(template.pointsShootValue)) ? Number(template.pointsShootValue) : currentShootValue;
      unit.pointsUnavailable = Boolean(template.pointsUnavailable);
      unit.specialRules = localizeSpecialRuleList(unit.specialRules || template.specialRules || "");
      return unit;
    }

    unit.artKey = detectUnitArtKey(unit);
    unit.pointsOverride = currentOverride;
    unit.pointsShootValue = currentShootValue;
    unit.pointsUnavailable = Boolean(unit.pointsUnavailable) || unit.category === "baggage";
    unit.specialRules = localizeSpecialRuleList(unit.specialRules || "");
    return unit;
  }

  function isTemplateProfileMatch(unit, template) {
    const comparableFields = ["category", "formation", "move", "shoot", "range", "melee", "morale"];
    return comparableFields.every((field) => String(unit[field] || "") === String(template[field] || ""))
      && Number(unit.stamina || 0) === Number(template.stamina || 0)
      && normalizeText(unit.armament || "") === normalizeText(template.armament || "")
      && normalizeText(localizeSpecialRuleList(unit.specialRules || "")) === normalizeText(localizeSpecialRuleList(template.specialRules || ""));
  }

  function detectUnitArtKey(unit) {
    if (unit.artKey && unitArtLookup[unit.artKey]) {
      return unit.artKey;
    }

    const summary = normalizeText(`${unit.name || ""} ${unit.armament || ""} ${unit.specialRules || ""}`);
    if (unit.category === "artillery") {
      return "artillery";
    }
    if (unit.category === "baggage") {
      return "baggage";
    }
    if (summary.includes("dragoon") || summary.includes("драгун")) {
      return "dragoons";
    }
    if (summary.includes("lancer") || summary.includes("копей")) {
      return "lancers";
    }
    if (summary.includes("cuirass") || summary.includes("кирас") || summary.includes("heavy cavalry") || summary.includes("тяжёлая конница")) {
      return "cuirassiers";
    }
    if (summary.includes("firelock") || summary.includes("flintlock") || summary.includes("plug bayonet") || summary.includes("кремн") || summary.includes("шты")) {
      return "firelock-infantry";
    }
    if (summary.includes("guard") || summary.includes("гвард") || summary.includes("stubborn") || summary.includes("superbly drilled") || summary.includes("безупречно вымуштрованные")) {
      return "guard-infantry";
    }
    if (summary.includes("warband") || summary.includes("варбанд") || summary.includes("highland") || summary.includes("гор")) {
      return "warband";
    }
    if (summary.includes("pike company") || summary.includes("пиковая рота")) {
      return "pike-and-shot";
    }
    if (summary.includes("pike") || summary.includes("пик")) {
      return getPointShootValue(unit) > 0 ? "pike-and-shot" : "pike-block";
    }
    if (unit.category === "horse") {
      return "cuirassiers";
    }
    if (unit.category === "foot") {
      return getPointShootValue(unit) > 0 ? "musketeers" : "pike-block";
    }
    return "";
  }

  function getUnitArt(unit) {
    const artKey = detectUnitArtKey(unit);
    return unitArtLookup[artKey] || "";
  }

  function buildUnitCardStyle(unit) {
    const art = getUnitArt(unit);
    return art ? `--unit-art: url('${art}');` : "";
  }

  function splitSpecialRules(value) {
    return value
      .split(",")
      .map((item) => item.trim())
      .map(localizeSpecialRuleName)
      .filter(Boolean);
  }

  function renderEmptyBattalia() {
    return `
      <article class="battalia-card">
        <p class="soft-text">Здесь пока пусто. Добавь баталию, а затем наполни её юнитами.</p>
      </article>
    `;
  }

  function formatCategory(category) {
    return {
      foot: "Пехота",
      horse: "Конница",
      artillery: "Артиллерия",
      baggage: "Обоз"
    }[category] || "Юнит";
  }

  function formatFormation(formation) {
    return {
      "battle-line": "Линия (Battle Line)",
      block: "Блок (Block)",
      column: "Колонна (Column)",
      skirmish: "Рассыпной строй (Skirmish)",
      warband: "Варбанда (Warband)",
      hedgehog: "Ёж (Hedgehog)",
      building: "Здание (Building)",
      limbered: "Походное положение"
    }[formation] || formation;
  }

  function formatCombatRole(role) {
    return {
      free: "Свободен",
      engaged: "В бою",
      supporting: "Поддержка"
    }[role] || "Свободен";
  }

  function formatLossState(lossState) {
    return {
      active: "На столе",
      "off-table": "Вне стола",
      destroyed: "Уничтожен"
    }[lossState] || "На столе";
  }

  function formatBattaliaType(type) {
    return {
      foot: "Пехотная баталия",
      horse: "Конная баталия",
      artillery: "Артиллерийская баталия",
      mixed: "Смешанная баталия",
      "forlorn-hope": "Передовой отряд"
    }[type] || "Баталия";
  }

  function buildSpecialRuleLookup() {
    const lookup = new Map();
    data.specialRules.forEach((rule) => {
      [rule.name, rule.originalName, ...(rule.aliases || []), rule.id].forEach((value) => {
        if (!value) {
          return;
        }
        lookup.set(normalizeText(value), rule.name);
      });
    });
    return lookup;
  }

  function localizeSpecialRuleName(value) {
    const cleaned = String(value || "").trim();
    if (!cleaned) {
      return "";
    }
    return specialRuleLookup.get(normalizeText(cleaned)) || translateLegacyText(cleaned);
  }

  function localizeSpecialRuleList(value) {
    return value
      .split(",")
      .map((item) => localizeSpecialRuleName(item))
      .filter(Boolean)
      .join(", ");
  }

  function translateLegacyText(value) {
    const map = {
      "Pike block": "Пиковый блок",
      "Left sleeve of shotte": "Левое крыло мушкетёров",
      "Right sleeve of shotte": "Правое крыло мушкетёров",
      "Horse regiment A": "Конный полк А",
      "Horse regiment B": "Конный полк Б",
      "Royalist foot battalia": "Пехотная баталия роялистов",
      "Veteran pikes": "Пики ветеранов",
      "Musketeers left": "Левые мушкетёры",
      "Musketeers right": "Правые мушкетёры",
      "Gun line": "Орудийная линия",
      "Saker battery": "Батарея сакеров",
      "Sir Arthur": "Сэр Артур",
      "Col. Harcourt": "Полк. Харкорт",
      "Lord Ashford": "Лорд Эшфорд",
      "Master Gunner Hale": "Мастер-канонир Хейл",
      "Matchlock muskets": "Фитильные мушкеты",
      "Sword, pistols": "Шпага, пистолеты",
      "Medium cannon": "Средняя пушка",
      "Удержать orchard и не допустить прорыва к baggage.": "Удержать сад и не допустить прорыва к обозу.",
      "Выбить синий центр с ridge и открыть дорогу для cavalry.": "Сбить синий центр с гребня и открыть дорогу для конницы.",
      "Демо-состав для проверки логики battalia, casualties и phase tracker.": "Демонстрационный состав для проверки статусов баталий, потерь и трекера фаз."
    };

    const cleaned = String(value || "");
    return map[cleaned] || cleaned;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`; }
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function escapeAttribute(value) { return escapeHtml(value); }
})();








