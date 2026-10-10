// ============================================
// iShop SHIPPING DATA — ALL 36 STATES + FCT
// Every LGA in Nigeria with location-based fees
// ============================================

const NIGERIA_SHIPPING_DATA = {

    // ============================================
    // SOUTH-WEST
    // ============================================
    'lagos': {
        name: 'Lagos',
        lgas: {
            'agege':                 { name: 'Agege', fee: 1500 },
            'ajeromi-ifelodun':      { name: 'Ajeromi-Ifelodun', fee: 1800 },
            'alimosho':              { name: 'Alimosho', fee: 1600 },
            'amuwo-odofin':          { name: 'Amuwo-Odofin', fee: 1800 },
            'apapa':                 { name: 'Apapa', fee: 1700 },
            'badagry':               { name: 'Badagry', fee: 2500 },
            'epe':                   { name: 'Epe', fee: 2500 },
            'eti-osa':               { name: 'Eti-Osa (VI, Ikoyi, Lekki)', fee: 1800 },
            'ibeju-lekki':           { name: 'Ibeju-Lekki', fee: 2200 },
            'ifako-ijaiye':          { name: 'Ifako-Ijaiye', fee: 1600 },
            'ikeja':                 { name: 'Ikeja', fee: 1500 },
            'ikorodu':               { name: 'Ikorodu', fee: 2000 },
            'kosofe':                { name: 'Kosofe', fee: 1600 },
            'lagos-island':          { name: 'Lagos Island', fee: 1700 },
            'lagos-mainland':        { name: 'Lagos Mainland', fee: 1600 },
            'mushin':                { name: 'Mushin', fee: 1500 },
            'ojo':                   { name: 'Ojo', fee: 1800 },
            'oshodi-isolo':          { name: 'Oshodi-Isolo', fee: 1500 },
            'shomolu':               { name: 'Shomolu', fee: 1600 },
            'surulere':              { name: 'Surulere', fee: 1500 }
        }
    },

    'ogun': {
        name: 'Ogun',
        lgas: {
            'abeokuta-north':        { name: 'Abeokuta North', fee: 2200 },
            'abeokuta-south':        { name: 'Abeokuta South', fee: 2200 },
            'ado-odo-ota':           { name: 'Ado-Odo/Ota', fee: 1800 },
            'ewekoro':               { name: 'Ewekoro', fee: 2200 },
            'ifo':                   { name: 'Ifo', fee: 1800 },
            'ijebu-east':            { name: 'Ijebu East', fee: 2500 },
            'ijebu-north':           { name: 'Ijebu North', fee: 2500 },
            'ijebu-north-east':      { name: 'Ijebu North East', fee: 2500 },
            'ijebu-ode':             { name: 'Ijebu Ode', fee: 2400 },
            'ikenne':                { name: 'Ikenne', fee: 2400 },
            'imeko-afon':            { name: 'Imeko Afon', fee: 2800 },
            'ipokia':                { name: 'Ipokia', fee: 2800 },
            'obafemi-owode':         { name: 'Obafemi Owode', fee: 2000 },
            'odeda':                 { name: 'Odeda', fee: 2200 },
            'odogbolu':              { name: 'Odogbolu', fee: 2400 },
            'ogun-waterside':        { name: 'Ogun Waterside', fee: 2800 },
            'remo-north':            { name: 'Remo North', fee: 2400 },
            'sagamu':                { name: 'Sagamu', fee: 2000 },
            'yewa-north':            { name: 'Yewa North', fee: 2600 },
            'yewa-south':            { name: 'Yewa South', fee: 2500 }
        }
    },

    'oyo': {
        name: 'Oyo',
        lgas: {
            'afijio':                { name: 'Afijio', fee: 2800 },
            'akinyele':              { name: 'Akinyele', fee: 2600 },
            'atiba':                 { name: 'Atiba', fee: 3000 },
            'atisbo':                { name: 'Atisbo', fee: 3000 },
            'egbeda':                { name: 'Egbeda', fee: 2600 },
            'ibadan-north':          { name: 'Ibadan North', fee: 2500 },
            'ibadan-north-east':     { name: 'Ibadan North-East', fee: 2500 },
            'ibadan-north-west':     { name: 'Ibadan North-West', fee: 2500 },
            'ibadan-south-east':     { name: 'Ibadan South-East', fee: 2500 },
            'ibadan-south-west':     { name: 'Ibadan South-West', fee: 2500 },
            'ibarapa-central':       { name: 'Ibarapa Central', fee: 3000 },
            'ibarapa-east':          { name: 'Ibarapa East', fee: 3000 },
            'ibarapa-north':         { name: 'Ibarapa North', fee: 3000 },
            'ido':                   { name: 'Ido', fee: 2600 },
            'irepo':                 { name: 'Irepo', fee: 3200 },
            'iseyin':                { name: 'Iseyin', fee: 3000 },
            'itesiwaju':             { name: 'Itesiwaju', fee: 3200 },
            'iwajowa':               { name: 'Iwajowa', fee: 3200 },
            'kajola':                { name: 'Kajola', fee: 3200 },
            'lagelu':                { name: 'Lagelu', fee: 2700 },
            'ogbomosho-north':       { name: 'Ogbomosho North', fee: 2800 },
            'ogbomosho-south':       { name: 'Ogbomosho South', fee: 2800 },
            'ogo-oluwa':             { name: 'Ogo Oluwa', fee: 3000 },
            'olorunsogo':            { name: 'Olorunsogo', fee: 3200 },
            'oluyole':               { name: 'Oluyole', fee: 2600 },
            'ona-ara':               { name: 'Ona Ara', fee: 2700 },
            'ore-lope':              { name: 'Orelope', fee: 3200 },
            'ori-ire':               { name: 'Ori Ire', fee: 3200 },
            'oyo-east':              { name: 'Oyo East', fee: 2900 },
            'oyo-west':              { name: 'Oyo West', fee: 2900 },
            'saki-east':             { name: 'Saki East', fee: 3500 },
            'saki-west':             { name: 'Saki West', fee: 3500 },
            'surulere-oyo':          { name: 'Surulere (Oyo)', fee: 3000 }
        }
    },

    'osun': {
        name: 'Osun',
        lgas: {
            'aiyedade':              { name: 'Aiyedade', fee: 3000 },
            'aiyedire':              { name: 'Aiyedire', fee: 3000 },
            'atakumosa-east':        { name: 'Atakumosa East', fee: 3200 },
            'atakumosa-west':        { name: 'Atakumosa West', fee: 3200 },
            'boluwaduro':            { name: 'Boluwaduro', fee: 3200 },
            'boripe':                { name: 'Boripe', fee: 3000 },
            'ede-north':             { name: 'Ede North', fee: 2900 },
            'ede-south':             { name: 'Ede South', fee: 2900 },
            'egbedore':              { name: 'Egbedore', fee: 2900 },
            'ejigbo':                { name: 'Ejigbo', fee: 3000 },
            'ifedayo':               { name: 'Ifedayo', fee: 3300 },
            'ife-central':           { name: 'Ife Central', fee: 2900 },
            'ife-east':              { name: 'Ife East', fee: 2900 },
            'ife-north':             { name: 'Ife North', fee: 3000 },
            'ife-south':             { name: 'Ife South', fee: 3000 },
            'ila':                   { name: 'Ila', fee: 3100 },
            'ilesa-east':            { name: 'Ilesa East', fee: 3000 },
            'ilesa-west':            { name: 'Ilesa West', fee: 3000 },
            'irepodun':              { name: 'Irepodun', fee: 3000 },
            'irewole':               { name: 'Irewole', fee: 3000 },
            'isokan':                { name: 'Isokan', fee: 3100 },
            'iwo':                   { name: 'Iwo', fee: 2900 },
            'obokun':                { name: 'Obokun', fee: 3100 },
            'odo-otin':              { name: 'Odo Otin', fee: 3100 },
            'ola-oluwa':             { name: 'Ola Oluwa', fee: 3300 },
            'olorunda':              { name: 'Olorunda', fee: 2900 },
            'oriade':                { name: 'Oriade', fee: 3100 },
            'orolu':                 { name: 'Orolu', fee: 3100 },
            'osoobo':                { name: 'Osoobo', fee: 2900 }
        }
    },

    'ondo': {
        name: 'Ondo',
        lgas: {
            'akoko-north-east':      { name: 'Akoko North-East', fee: 3200 },
            'akoko-north-west':      { name: 'Akoko North-West', fee: 3200 },
            'akoko-south-east':      { name: 'Akoko South-East', fee: 3300 },
            'akoko-south-west':      { name: 'Akoko South-West', fee: 3300 },
            'akure-north':           { name: 'Akure North', fee: 3000 },
            'akure-south':           { name: 'Akure South', fee: 3000 },
            'ese-odo':               { name: 'Ese Odo', fee: 3500 },
            'idanre':                { name: 'Idanre', fee: 3100 },
            'ifedore':               { name: 'Ifedore', fee: 3100 },
            'ilaje':                 { name: 'Ilaje', fee: 3600 },
            'ile-oluji-okeigbo':     { name: 'Ile-Oluji/Okeigbo', fee: 3100 },
            'irele':                 { name: 'Irele', fee: 3500 },
            'odi-odo':               { name: 'Odi Odo', fee: 3500 },
            'okitipupa':             { name: 'Okitipupa', fee: 3400 },
            'ondo-east':             { name: 'Ondo East', fee: 3100 },
            'ondo-west':             { name: 'Ondo West', fee: 3100 },
            'ose':                   { name: 'Ose', fee: 3400 },
            'owo':                   { name: 'Owo', fee: 3200 }
        }
    },

    'ekiti': {
        name: 'Ekiti',
        lgas: {
            'ado-ekiti':             { name: 'Ado Ekiti', fee: 2800 },
            'efon':                  { name: 'Efon', fee: 3000 },
            'ekiti-east':            { name: 'Ekiti East', fee: 2900 },
            'ekiti-south-west':      { name: 'Ekiti South-West', fee: 2900 },
            'ekiti-west':            { name: 'Ekiti West', fee: 2900 },
            'emure':                 { name: 'Emure', fee: 3000 },
            'gbonyin':               { name: 'Gbonyin', fee: 2900 },
            'ido-osi':               { name: 'Ido Osi', fee: 2800 },
            'ijero':                 { name: 'Ijero', fee: 2900 },
            'ikere':                 { name: 'Ikere', fee: 2800 },
            'ikole':                 { name: 'Ikole', fee: 3000 },
            'ilejemeje':             { name: 'Ilejemeje', fee: 3000 },
            'irepodun-ifelodun':     { name: 'Irepodun/Ifelodun', fee: 2900 },
            'ise-orun':              { name: 'Ise/Orun', fee: 3000 },
            'moba':                  { name: 'Moba', fee: 3000 },
            'oye':                   { name: 'Oye', fee: 2900 }
        }
    },

    // ============================================
    // SOUTH-EAST
    // ============================================
    'abia': {
        name: 'Abia',
        lgas: {
            'aba-north':             { name: 'Aba North', fee: 2800 },
            'aba-south':             { name: 'Aba South', fee: 2800 },
            'arochukwu':             { name: 'Arochukwu', fee: 3200 },
            'bende':                 { name: 'Bende', fee: 3000 },
            'ikwuano':               { name: 'Ikwuano', fee: 3000 },
            'isiala-ngwa-north':     { name: 'Isiala Ngwa North', fee: 2900 },
            'isiala-ngwa-south':     { name: 'Isiala Ngwa South', fee: 2900 },
            'isuikwuato':            { name: 'Isuikwuato', fee: 3100 },
            'obi-ngwa':              { name: 'Obi Ngwa', fee: 2900 },
            'ohafia':                { name: 'Ohafia', fee: 3100 },
            'osisioma':              { name: 'Osisioma', fee: 2900 },
            'ugwunagbo':             { name: 'Ugwunagbo', fee: 2900 },
            'ukwa-east':             { name: 'Ukwa East', fee: 3000 },
            'ukwa-west':             { name: 'Ukwa West', fee: 3000 },
            'umuahia-north':         { name: 'Umuahia North', fee: 2800 },
            'umuahia-south':         { name: 'Umuahia South', fee: 2800 },
            'umu-nneochi':           { name: 'Umu Nneochi', fee: 3200 }
        }
    },

    'imo': {
        name: 'Imo',
        lgas: {
            'aboh-mbaise':           { name: 'Aboh Mbaise', fee: 2900 },
            'ahiazu-mbaise':         { name: 'Ahiazu Mbaise', fee: 2900 },
            'ehime-mbano':           { name: 'Ehime Mbano', fee: 3100 },
            'ezinihitte':            { name: 'Ezinihitte', fee: 2900 },
            'ideato-north':          { name: 'Ideato North', fee: 3100 },
            'ideato-south':          { name: 'Ideato South', fee: 3100 },
            'ihitte-uboma':          { name: 'Ihitte/Uboma', fee: 3100 },
            'ikeduru':               { name: 'Ikeduru', fee: 2900 },
            'isiala-mbano':          { name: 'Isiala Mbano', fee: 3100 },
            'isu':                   { name: 'Isu', fee: 3100 },
            'mbaitoli':              { name: 'Mbaitoli', fee: 2900 },
            'ngor-okpala':           { name: 'Ngor Okpala', fee: 2900 },
            'njaba':                 { name: 'Njaba', fee: 3100 },
            'nkwerre':               { name: 'Nkwerre', fee: 3100 },
            'nwangele':              { name: 'Nwangele', fee: 3100 },
            'obowo':                 { name: 'Obowo', fee: 3000 },
            'oguta':                 { name: 'Oguta', fee: 3000 },
            'ohaji-egbema':          { name: 'Ohaji/Egbema', fee: 3000 },
            'okigwe':                { name: 'Okigwe', fee: 3100 },
            'orlu':                  { name: 'Orlu', fee: 3000 },
            'orsu':                  { name: 'Orsu', fee: 3100 },
            'oru-east':              { name: 'Oru East', fee: 3100 },
            'oru-west':              { name: 'Oru West', fee: 3100 },
            'owerri-municipal':      { name: 'Owerri Municipal', fee: 2800 },
            'owerri-north':          { name: 'Owerri North', fee: 2800 },
            'owerri-west':           { name: 'Owerri West', fee: 2800 },
            'unuimo':                { name: 'Unuimo', fee: 3100 }
        }
    },

    'enugu': {
        name: 'Enugu',
        lgas: {
            'anini':                 { name: 'Aninri', fee: 3000 },
            'awgu':                  { name: 'Awgu', fee: 3000 },
            'enugu-east':            { name: 'Enugu East', fee: 2800 },
            'enugu-north':           { name: 'Enugu North', fee: 2800 },
            'enugu-south':           { name: 'Enugu South', fee: 2800 },
            'ezeagu':                { name: 'Ezeagu', fee: 3000 },
            'igbo-etiti':            { name: 'Igbo Etiti', fee: 3000 },
            'igbo-eze-north':        { name: 'Igbo Eze North', fee: 3100 },
            'igbo-eze-south':        { name: 'Igbo Eze South', fee: 3000 },
            'isi-uzo':               { name: 'Isi Uzo', fee: 3100 },
            'nkANU-east':            { name: 'Nkanu East', fee: 2900 },
            'nkANU-west':            { name: 'Nkanu West', fee: 2900 },
            'nsukka':                { name: 'Nsukka', fee: 3000 },
            'oji-river':             { name: 'Oji River', fee: 3000 },
            'udenu':                 { name: 'Udenu', fee: 3100 },
            'udi':                   { name: 'Udi', fee: 2900 },
            'uzo-uwani':             { name: 'Uzo Uwani', fee: 3100 }
        }
    },

    'anambra': {
        name: 'Anambra',
        lgas: {
            ' Aguata':               { name: 'Aguata', fee: 3000 },
            'anambra-east':          { name: 'Anambra East', fee: 3000 },
            'anambra-west':          { name: 'Anambra West', fee: 3100 },
            'anaocha':               { name: 'Anaocha', fee: 3000 },
            'awka-north':            { name: 'Awka North', fee: 2900 },
            'awka-south':            { name: 'Awka South', fee: 2900 },
            'ayamelum':              { name: 'Ayamelum', fee: 3100 },
            'dunukofia':             { name: 'Dunukofia', fee: 2900 },
            'ekwusigo':              { name: 'Ekwusigo', fee: 3000 },
            'idemili-north':         { name: 'Idemili North', fee: 2900 },
            'idemili-south':         { name: 'Idemili South', fee: 2900 },
            'ihiala':                { name: 'Ihiala', fee: 3000 },
            'njikoka':               { name: 'Njikoka', fee: 2900 },
            'nnewi-north':           { name: 'Nnewi North', fee: 3000 },
            'nnewi-south':           { name: 'Nnewi South', fee: 3000 },
            'ogbaru':                { name: 'Ogbaru', fee: 3000 },
            'onitsha-north':         { name: 'Onitsha North', fee: 3000 },
            'onitsha-south':         { name: 'Onitsha South', fee: 3000 },
            'orumba-north':          { name: 'Orumba North', fee: 3100 },
            'orumba-south':          { name: 'Orumba South', fee: 3100 },
            'oyi':                   { name: 'Oyi', fee: 2900 }
        }
    },

    'ebonyi': {
        name: 'Ebonyi',
        lgas: {
            'abakaliki':             { name: 'Abakaliki', fee: 3000 },
            'afikpo-north':          { name: 'Afikpo North', fee: 3200 },
            'afikpo-south':          { name: 'Afikpo South', fee: 3200 },
            'ebonyi':                { name: 'Ebonyi', fee: 3100 },
            'ezza-north':            { name: 'Ezza North', fee: 3100 },
            'ezza-south':            { name: 'Ezza South', fee: 3100 },
            'ikwo':                  { name: 'Ikwo', fee: 3200 },
            'ishielu':               { name: 'Ishielu', fee: 3100 },
            'ivo':                   { name: 'Ivo', fee: 3100 },
            'izzi':                  { name: 'Izzi', fee: 3100 },
            'ohaozara':              { name: 'Ohaozara', fee: 3200 },
            'ohaukwu':               { name: 'Ohaukwu', fee: 3200 },
            'onicha':                { name: 'Onicha', fee: 3200 }
        }
    },

    // ============================================
    // SOUTH-SOUTH
    // ============================================
    'delta': {
        name: 'Delta',
        lgas: {
            'aniocha-north':         { name: 'Aniocha North', fee: 3100 },
            'aniocha-south':         { name: 'Aniocha South', fee: 3100 },
            'bomadi':                { name: 'Bomadi', fee: 3300 },
            'burutu':                { name: 'Burutu', fee: 3400 },
            'ethiope-east':          { name: 'Ethiope East', fee: 3000 },
            'ethiope-west':          { name: 'Ethiope West', fee: 3000 },
            'ika-north-east':        { name: 'Ika North East', fee: 3100 },
            'ika-south':             { name: 'Ika South', fee: 3100 },
            'isoko-north':           { name: 'Isoko North', fee: 3200 },
            'isoko-south':           { name: 'Isoko South', fee: 3200 },
            'ndokwa-east':           { name: 'Ndokwa East', fee: 3200 },
            'ndokwa-west':           { name: 'Ndokwa West', fee: 3200 },
            'okpe':                  { name: 'Okpe', fee: 3000 },
            'oshimili-north':        { name: 'Oshimili North', fee: 3000 },
            'oshimili-south':        { name: 'Oshimili South (Asaba)', fee: 2900 },
            'patani':                { name: 'Patani', fee: 3300 },
            'sapele':                { name: 'Sapele', fee: 3000 },
            'udu':                   { name: 'Udu', fee: 3000 },
            'ughelli-north':         { name: 'Ughelli North', fee: 3100 },
            'ughelli-south':         { name: 'Ughelli South', fee: 3100 },
            'ukwuani':               { name: 'Ukwuani', fee: 3200 },
            'uvwie':                 { name: 'Uvwie', fee: 3000 },
            'warri-north':           { name: 'Warri North', fee: 3200 },
            'warri-south':           { name: 'Warri South', fee: 3000 },
            'warri-south-west':      { name: 'Warri South-West', fee: 3200 }
        }
    },

    'edo': {
        name: 'Edo',
        lgas: {
            'akoko-edo':             { name: 'Akoko-Edo', fee: 3200 },
            'egor':                  { name: 'Egor', fee: 2900 },
            'esan-central':          { name: 'Esan Central', fee: 3100 },
            'esan-north-east':       { name: 'Esan North-East', fee: 3100 },
            'esan-south-east':       { name: 'Esan South-East', fee: 3100 },
            'esan-west':             { name: 'Esan West', fee: 3100 },
            'etsako-central':        { name: 'Etsako Central', fee: 3200 },
            'etsako-east':           { name: 'Etsako East', fee: 3200 },
            'etsako-west':           { name: 'Etsako West', fee: 3200 },
            'igueben':               { name: 'Igueben', fee: 3100 },
            'ikpoba-okha':           { name: 'Ikpoba-Okha', fee: 2900 },
            'oredo':                 { name: 'Oredo (Benin City)', fee: 2800 },
            'orhionmwon':            { name: 'Orhionmwon', fee: 3100 },
            'ovia-north-east':       { name: 'Ovia North-East', fee: 2900 },
            'ovia-south-west':       { name: 'Ovia South-West', fee: 3000 },
            'owan-east':             { name: 'Owan East', fee: 3200 },
            'owan-west':             { name: 'Owan West', fee: 3200 },
            'uhunmwonde':            { name: 'Uhunmwonde', fee: 3000 }
        }
    },

    'rivers': {
        name: 'Rivers',
        lgas: {
            'abua-odual':            { name: 'Abua/Odual', fee: 3200 },
            'ahoada-east':           { name: 'Ahoada East', fee: 3100 },
            'ahoada-west':           { name: 'Ahoada West', fee: 3100 },
            'akuku-toru':            { name: 'Akuku-Toru', fee: 3300 },
            'andoni':                { name: 'Andoni', fee: 3300 },
            'asari-toru':            { name: 'Asari-Toru', fee: 3300 },
            'bonny':                 { name: 'Bonny', fee: 3400 },
            'degema':                { name: 'Degema', fee: 3300 },
            'eleme':                 { name: 'Eleme', fee: 3000 },
            'emohua':                { name: 'Emohua', fee: 3000 },
            'etche':                 { name: 'Etche', fee: 3100 },
            'gokana':                { name: 'Gokana', fee: 3100 },
            'ikwerre':               { name: 'Ikwerre', fee: 3000 },
            'khana':                 { name: 'Khana', fee: 3200 },
            'obio-akpor':            { name: 'Obio/Akpor', fee: 2900 },
            'ogba-egbema-ndoni':     { name: 'Ogba/Egbema/Ndoni', fee: 3100 },
            'ogu-bolo':              { name: 'Ogu/Bolo', fee: 3200 },
            'okrika':                { name: 'Okrika', fee: 3000 },
            'omuma':                 { name: 'Omuma', fee: 3100 },
            'opobo-nkoro':           { name: 'Opobo/Nkoro', fee: 3300 },
            'oyigbo':                { name: 'Oyigbo', fee: 3100 },
            'port-harcourt':         { name: 'Port Harcourt', fee: 2800 },
            'tai':                   { name: 'Tai', fee: 3200 }
        }
    },

    'bayelsa': {
        name: 'Bayelsa',
        lgas: {
            'brass':                 { name: 'Brass', fee: 3500 },
            'ekeremor':              { name: 'Ekeremor', fee: 3400 },
            'kolokuma-opokuma':      { name: 'Kolokuma/Opokuma', fee: 3200 },
            'nembe':                 { name: 'Nembe', fee: 3400 },
            'ogbia':                 { name: 'Ogbia', fee: 3200 },
            'sagbama':               { name: 'Sagbama', fee: 3300 },
            'southern-ijaw':         { name: 'Southern Ijaw', fee: 3500 },
            'yenagoa':               { name: 'Yenagoa', fee: 3000 }
        }
    },

    'akwa-ibom': {
        name: 'Akwa Ibom',
        lgas: {
            'abak':                  { name: 'Abak', fee: 3200 },
            'eastern-obolo':         { name: 'Eastern Obolo', fee: 3400 },
            'eket':                  { name: 'Eket', fee: 3300 },
            'esit-eket':             { name: 'Esit Eket', fee: 3300 },
            'essien-udim':           { name: 'Essien Udim', fee: 3200 },
            'etim-ekpo':             { name: 'Etim Ekpo', fee: 3200 },
            'etinan':                { name: 'Etinan', fee: 3100 },
            'ibeno':                 { name: 'Ibeno', fee: 3400 },
            'ibesikpo-asutan':       { name: 'Ibesikpo Asutan', fee: 3000 },
            'ibiono-ibom':           { name: 'Ibiono-Ibom', fee: 3200 },
            'ika':                   { name: 'Ika', fee: 3200 },
            'ikono':                 { name: 'Ikono', fee: 3200 },
            'ikot-abasi':            { name: 'Ikot Abasi', fee: 3300 },
            'ikot-ekpene':           { name: 'Ikot Ekpene', fee: 3200 },
            'ini':                   { name: 'Ini', fee: 3300 },
            'itu':                   { name: 'Itu', fee: 3100 },
            'mbo':                   { name: 'Mbo', fee: 3400 },
            'mkpat-enin':            { name: 'Mkpat-Enin', fee: 3300 },
            'nsit-atai':             { name: 'Nsit-Atai', fee: 3200 },
            'nsit-ibom':             { name: 'Nsit-Ibom', fee: 3100 },
            'nsit-ubium':            { name: 'Nsit-Ubium', fee: 3200 },
            'obot-akara':            { name: 'Obot Akara', fee: 3300 },
            'okobo':                 { name: 'Okobo', fee: 3300 },
            'onna':                  { name: 'Onna', fee: 3200 },
            'oron':                  { name: 'Oron', fee: 3300 },
            'udung-uko':             { name: 'Udung-Uko', fee: 3400 },
            'ukanafun':              { name: 'Ukanafun', fee: 3300 },
            'uruan':                 { name: 'Uruan', fee: 3000 },
            'urue-offong-oruko':     { name: 'Urue-Offong/Oruko', fee: 3400 },
            'uyo':                   { name: 'Uyo', fee: 2900 }
        }
    },

    'cross-river': {
        name: 'Cross River',
        lgas: {
            'abi':                   { name: 'Abi', fee: 3300 },
            'akamkpa':               { name: 'Akamkpa', fee: 3200 },
            'akpabuyo':              { name: 'Akpabuyo', fee: 3200 },
            'bakassi':               { name: 'Bakassi', fee: 3500 },
            'bekwarra':              { name: 'Bekwarra', fee: 3400 },
            'biase':                 { name: 'Biase', fee: 3300 },
            'boki':                  { name: 'Boki', fee: 3300 },
            'calabar-municipal':     { name: 'Calabar Municipal', fee: 3000 },
            'calabar-south':         { name: 'Calabar South', fee: 3000 },
            'etung':                 { name: 'Etung', fee: 3300 },
            'ikom':                  { name: 'Ikom', fee: 3300 },
            'obanliku':              { name: 'Obanliku', fee: 3500 },
            'obubra':                { name: 'Obubra', fee: 3300 },
            'obudu':                 { name: 'Obudu', fee: 3400 },
            'odukpani':              { name: 'Odukpani', fee: 3100 },
            'ogoja':                 { name: 'Ogoja', fee: 3400 },
            'yakuur':                { name: 'Yakuur', fee: 3400 },
            'yala':                  { name: 'Yala', fee: 3400 }
        }
    },

    // ============================================
    // NORTH-CENTRAL
    // ============================================
    'abuja': {
        name: 'Abuja (FCT)',
        lgas: {
            'abaji':                 { name: 'Abaji', fee: 2800 },
            'abuja-municipal':       { name: 'Abuja Municipal (AMAC)', fee: 2500 },
            'bwari':                 { name: 'Bwari', fee: 2700 },
            'gwagwalada':            { name: 'Gwagwalada', fee: 2700 },
            'kuje':                  { name: 'Kuje', fee: 2800 },
            'kwali':                 { name: 'Kwali', fee: 2800 }
        }
    },

    'benue': {
        name: 'Benue',
        lgas: {
            'ado':                   { name: 'Ado', fee: 3400 },
            'agatu':                 { name: 'Agatu', fee: 3400 },
            'apa':                   { name: 'Apa', fee: 3400 },
            'buruku':                { name: 'Buruku', fee: 3300 },
            'gboko':                 { name: 'Gboko', fee: 3300 },
            'guma':                  { name: 'Guma', fee: 3400 },
            'gwer-east':             { name: 'Gwer East', fee: 3300 },
            'gwer-west':             { name: 'Gwer West', fee: 3400 },
            'katsina-ala':           { name: 'Katsina-Ala', fee: 3400 },
            'konshisha':             { name: 'Konshisha', fee: 3400 },
            'kwande':                { name: 'Kwande', fee: 3500 },
            'logo':                  { name: 'Logo', fee: 3400 },
            'makurdi':               { name: 'Makurdi', fee: 3200 },
            'obi':                   { name: 'Obi', fee: 3400 },
            'ogbadibo':              { name: 'Ogbadibo', fee: 3400 },
            'ohimini':               { name: 'Ohimini', fee: 3400 },
            'oju':                   { name: 'Oju', fee: 3500 },
            'okpokwu':               { name: 'Okpokwu', fee: 3400 },
            'otukpo':                { name: 'Otukpo', fee: 3400 },
            'tarka':                 { name: 'Tarka', fee: 3400 },
            'ukum':                  { name: 'Ukum', fee: 3500 },
            'ushongo':               { name: 'Ushongo', fee: 3400 },
            'vandeikya':             { name: 'Vandeikya', fee: 3500 }
        }
    },

    'kogi': {
        name: 'Kogi',
        lgas: {
            'adavi':                 { name: 'Adavi', fee: 3300 },
            'ajaokuta':              { name: 'Ajaokuta', fee: 3400 },
            'ankpa':                 { name: 'Ankpa', fee: 3400 },
            'bassa':                 { name: 'Bassa', fee: 3400 },
            'dekina':                { name: 'Dekina', fee: 3300 },
            'ibaji':                 { name: 'Ibaji', fee: 3500 },
            'idah':                  { name: 'Idah', fee: 3400 },
            'igalamela-odolu':       { name: 'Igalamela-Odolu', fee: 3400 },
            'ijumu':                 { name: 'Ijumu', fee: 3400 },
            'kabba-bunu':            { name: 'Kabba/Bunu', fee: 3400 },
            'kogi-kk':               { name: 'Kogi (KK)', fee: 3300 },
            'lokoja':                { name: 'Lokoja', fee: 3200 },
            'mopa-muro':             { name: 'Mopa-Muro', fee: 3400 },
            'ofu':                   { name: 'Ofu', fee: 3400 },
            'ogori-magongo':         { name: 'Ogori/Magongo', fee: 3400 },
            'okehi':                 { name: 'Okehi', fee: 3300 },
            'okene':                 { name: 'Okene', fee: 3300 },
            'olamaboro':             { name: 'Olamaboro', fee: 3400 },
            'omala':                 { name: 'Omala', fee: 3400 },
            'yagba-east':            { name: 'Yagba East', fee: 3400 },
            'yagba-west':            { name: 'Yagba West', fee: 3400 }
        }
    },

    'kwara': {
        name: 'Kwara',
        lgas: {
            'asa':                   { name: 'Asa', fee: 3200 },
            'baruten':               { name: 'Baruten', fee: 3500 },
            'edu':                   { name: 'Edu', fee: 3300 },
            'ekiti-kwara':           { name: 'Ekiti (Kwara)', fee: 3300 },
            'ifelodun':              { name: 'Ifelodun', fee: 3200 },
            'ilorin-east':           { name: 'Ilorin East', fee: 3000 },
            'ilorin-south':          { name: 'Ilorin South', fee: 3000 },
            'ilorin-west':           { name: 'Ilorin West', fee: 3000 },
            'irepodun':              { name: 'Irepodun', fee: 3200 },
            'isin':                  { name: 'Isin', fee: 3300 },
            'kaiama':                { name: 'Kaiama', fee: 3500 },
            'moro':                  { name: 'Moro', fee: 3300 },
            'offa':                  { name: 'Offa', fee: 3200 },
            'oke-ero':               { name: 'Oke Ero', fee: 3300 },
            'oyun':                  { name: 'Oyun', fee: 3200 },
            'pategi':                { name: 'Pategi', fee: 3400 }
        }
    },

    'nasarawa': {
        name: 'Nasarawa',
        lgas: {
            'akwanga':               { name: 'Akwanga', fee: 3200 },
            'awe':                   { name: 'Awe', fee: 3300 },
            'doma':                  { name: 'Doma', fee: 3200 },
            'karu':                  { name: 'Karu', fee: 2900 },
            'keana':                 { name: 'Keana', fee: 3200 },
            'keffi':                 { name: 'Keffi', fee: 2900 },
            'kokona':                { name: 'Kokona', fee: 3000 },
            'lafia':                 { name: 'Lafia', fee: 3100 },
            'nasarawa':              { name: 'Nasarawa', fee: 3100 },
            'nasarawa-eggon':        { name: 'Nasarawa Eggon', fee: 3200 },
            'obi':                   { name: 'Obi', fee: 3300 },
            'toto':                  { name: 'Toto', fee: 3300 },
            'wamba':                 { name: 'Wamba', fee: 3300 }
        }
    },

    'niger': {
        name: 'Niger',
        lgas: {
            'agaie':                 { name: 'Agaie', fee: 3400 },
            'agwara':                { name: 'Agwara', fee: 3500 },
            'bida':                  { name: 'Bida', fee: 3300 },
            'borgu':                 { name: 'Borgu', fee: 3500 },
            'bosso':                 { name: 'Bosso', fee: 3100 },
            'chanchaga':             { name: 'Chanchaga (Minna)', fee: 3100 },
            'edati':                 { name: 'Edati', fee: 3300 },
            'gbako':                 { name: 'Gbako', fee: 3300 },
            'gurara':                { name: 'Gurara', fee: 3400 },
            'katcha':                { name: 'Katcha', fee: 3400 },
            'kontagora':             { name: 'Kontagora', fee: 3500 },
            'lapai':                 { name: 'Lapai', fee: 3300 },
            'lavun':                 { name: 'Lavun', fee: 3400 },
            'magama':                { name: 'Magama', fee: 3500 },
            'mariga':                { name: 'Mariga', fee: 3500 },
            'mashegu':               { name: 'Mashegu', fee: 3500 },
            'mokwa':                 { name: 'Mokwa', fee: 3400 },
            'moya':                  { name: 'Moya', fee: 3400 },
            'paikoro':               { name: 'Paikoro', fee: 3300 },
            'rafi':                  { name: 'Rafi', fee: 3400 },
            'rijau':                 { name: 'Rijau', fee: 3500 },
            'shiroro':               { name: 'Shiroro', fee: 3400 },
            'suleja':                { name: 'Suleja', fee: 2900 },
            'tafa':                  { name: 'Tafa', fee: 3000 },
            'wushishi':              { name: 'Wushishi', fee: 3400 }
        }
    },

    'plateau': {
        name: 'Plateau',
        lgas: {
            'barkin-ladi':           { name: 'Barkin Ladi', fee: 3400 },
            'bassa':                 { name: 'Bassa', fee: 3400 },
            'bokkos':                { name: 'Bokkos', fee: 3400 },
            'jos-east':              { name: 'Jos East', fee: 3300 },
            'jos-north':             { name: 'Jos North', fee: 3200 },
            'jos-south':             { name: 'Jos South', fee: 3200 },
            'kanam':                 { name: 'Kanam', fee: 3500 },
            'kanke':                 { name: 'Kanke', fee: 3400 },
            'langtang-north':        { name: 'Langtang North', fee: 3500 },
            'langtang-south':        { name: 'Langtang South', fee: 3500 },
            'mangu':                 { name: 'Mangu', fee: 3400 },
            'mikang':                { name: 'Mikang', fee: 3500 },
            'pankshin':              { name: 'Pankshin', fee: 3400 },
            'quaan-pan':             { name: 'Quaan Pan', fee: 3500 },
            'riyom':                 { name: 'Riyom', fee: 3400 },
            'shendam':               { name: 'Shendam', fee: 3500 },
            'wase':                  { name: 'Wase', fee: 3500 }
        }
    },

    // ============================================
    // NORTH-WEST
    // ============================================
    'kano': {
        name: 'Kano',
        lgas: {
            'ajingi':                { name: 'Ajingi', fee: 3400 },
            'albasu':                { name: 'Albasu', fee: 3400 },
            'bagwai':                { name: 'Bagwai', fee: 3400 },
            'bebeji':                { name: 'Bebeji', fee: 3400 },
            'bichi':                 { name: 'Bichi', fee: 3400 },
            'bunkure':               { name: 'Bunkure', fee: 3400 },
            'dala':                  { name: 'Dala', fee: 3200 },
            'dambatta':              { name: 'Dambatta', fee: 3400 },
            'dawakin-kudu':          { name: 'Dawakin Kudu', fee: 3300 },
            'dawakin-tofa':          { name: 'Dawakin Tofa', fee: 3300 },
            'doguwa':                { name: 'Doguwa', fee: 3500 },
            'fagge':                 { name: 'Fagge', fee: 3200 },
            'gabasawa':              { name: 'Gabasawa', fee: 3400 },
            'garko':                 { name: 'Garko', fee: 3400 },
            'garun-mallam':          { name: 'Garun Mallam', fee: 3400 },
            'gaya':                  { name: 'Gaya', fee: 3400 },
            'gezawa':                { name: 'Gezawa', fee: 3300 },
            'gwale':                 { name: 'Gwale', fee: 3200 },
            'gwarzo':                { name: 'Gwarzo', fee: 3400 },
            'kabo':                  { name: 'Kabo', fee: 3400 },
            'kano-municipal':        { name: 'Kano Municipal', fee: 3100 },
            'karaye':                { name: 'Karaye', fee: 3400 },
            'kibiya':                { name: 'Kibiya', fee: 3500 },
            'kiru':                  { name: 'Kiru', fee: 3400 },
            'kumbotso':              { name: 'Kumbotso', fee: 3200 },
            'kunchi':                { name: 'Kunchi', fee: 3400 },
            'kurmi':                 { name: 'Kurmi', fee: 3500 },
            'madobi':                { name: 'Madobi', fee: 3300 },
            'makoda':                { name: 'Makoda', fee: 3400 },
            'minjibir':              { name: 'Minjibir', fee: 3400 },
            'nasarawa-kano':         { name: 'Nasarawa', fee: 3200 },
            'rano':                  { name: 'Rano', fee: 3400 },
            'rimin-gado':            { name: 'Rimin Gado', fee: 3400 },
            'rogO':                  { name: 'Rogo', fee: 3400 },
            'shanono':               { name: 'Shanono', fee: 3400 },
            'sumaila':               { name: 'Sumaila', fee: 3500 },
            'takai':                 { name: 'Takai', fee: 3400 },
            'tarauni':               { name: 'Tarauni', fee: 3200 },
            'toska':                 { name: 'Tofa', fee: 3400 },
            'tsanyawa':              { name: 'Tsanyawa', fee: 3400 },
            'tudun-wada':            { name: 'Tudun Wada', fee: 3300 },
            'ungogo':                { name: 'Ungogo', fee: 3200 },
            'warawa':                { name: 'Warawa', fee: 3400 },
            'wudil':                 { name: 'Wudil', fee: 3300 }
        }
    },

    'katsina': {
        name: 'Katsina',
        lgas: {
            'bakori':                { name: 'Bakori', fee: 3500 },
            'batagarawa':            { name: 'Batagarawa', fee: 3400 },
            'batsari':               { name: 'Batsari', fee: 3500 },
            'baure':                 { name: 'Baure', fee: 3500 },
            'bindawa':               { name: 'Bindawa', fee: 3500 },
            'charanchi':             { name: 'Charanchi', fee: 3500 },
            'dan-musa':              { name: 'Dan Musa', fee: 3500 },
            'dandume':               { name: 'Dandume', fee: 3500 },
            'danja':                 { name: 'Danja', fee: 3500 },
            'daura':                 { name: 'Daura', fee: 3500 },
            'duTsin-ma':             { name: 'Dutsin Ma', fee: 3500 },
            'faskari':               { name: 'Faskari', fee: 3600 },
            'funtua':                { name: 'Funtua', fee: 3400 },
            'ingawa':                { name: 'Ingawa', fee: 3500 },
            'jibia':                 { name: 'Jibia', fee: 3500 },
            'kafur':                 { name: 'Kafur', fee: 3500 },
            'kaita':                 { name: 'Kaita', fee: 3500 },
            'kankara':               { name: 'Kankara', fee: 3500 },
            'kankia':                { name: 'Kankia', fee: 3500 },
            'katsina':               { name: 'Katsina', fee: 3300 },
            'kurfi':                 { name: 'Kurfi', fee: 3500 },
            'kusada':                { name: 'Kusada', fee: 3500 },
            'maiadua':               { name: 'Mai\'Adua', fee: 3600 },
            'malumfashi':            { name: 'Malumfashi', fee: 3500 },
            'mani':                  { name: 'Mani', fee: 3500 },
            'mashi':                 { name: 'Mashi', fee: 3500 },
            'matazu':                { name: 'Matazu', fee: 3500 },
            'musawa':                { name: 'Musawa', fee: 3500 },
            'rimi':                  { name: 'Rimi', fee: 3500 },
            'sabuwa':                { name: 'Sabuwa', fee: 3600 },
            'safana':                { name: 'Safana', fee: 3500 },
            'sandamu':               { name: 'Sandamu', fee: 3500 },
            'zango':                 { name: 'Zango', fee: 3500 }
        }
    },

    'kaduna': {
        name: 'Kaduna',
        lgas: {
            'birnin-gwari':          { name: 'Birnin Gwari', fee: 3500 },
            'chikun':                { name: 'Chikun', fee: 3200 },
            'giwa':                  { name: 'Giwa', fee: 3400 },
            'igabi':                 { name: 'Igabi', fee: 3200 },
            'ikara':                 { name: 'Ikara', fee: 3400 },
            'jaba':                  { name: 'Jaba', fee: 3400 },
            'jema-a':                { name: 'Jema\'a', fee: 3400 },
            'kACHIA':                { name: 'Kachia', fee: 3400 },
            'kaduna-north':          { name: 'Kaduna North', fee: 3100 },
            'kaduna-south':          { name: 'Kaduna South', fee: 3100 },
            'kagarko':               { name: 'Kagarko', fee: 3400 },
            'kajuru':                { name: 'Kajuru', fee: 3300 },
            'kaura':                 { name: 'Kaura', fee: 3500 },
            'kauru':                 { name: 'Kauru', fee: 3500 },
            'kubau':                 { name: 'Kubau', fee: 3400 },
            'kudan':                 { name: 'Kudan', fee: 3400 },
            'lere':                  { name: 'Lere', fee: 3500 },
            'makarfi':               { name: 'Makarfi', fee: 3400 },
            'sabon-gari':            { name: 'Sabon Gari', fee: 3200 },
            'sanga':                 { name: 'Sanga', fee: 3500 },
            'soba':                  { name: 'Soba', fee: 3400 },
            'zangon-kataf':          { name: 'Zangon Kataf', fee: 3500 },
            'zaria':                 { name: 'Zaria', fee: 3200 }
        }
    },

    'kebbi': {
        name: 'Kebbi',
        lgas: {
            'aleiro':                { name: 'Aleiro', fee: 3600 },
            'arewa-dandi':           { name: 'Arewa Dandi', fee: 3600 },
            'argungu':               { name: 'Argungu', fee: 3600 },
            'augie':                 { name: 'Augie', fee: 3600 },
            'bagudo':                { name: 'Bagudo', fee: 3600 },
            'birnin-kebbi':          { name: 'Birnin Kebbi', fee: 3400 },
            'bunza':                 { name: 'Bunza', fee: 3600 },
            'dandi':                 { name: 'Dandi', fee: 3600 },
            'fakai':                 { name: 'Fakai', fee: 3700 },
            'gwandu':                { name: 'Gwandu', fee: 3600 },
            'jega':                  { name: 'Jega', fee: 3600 },
            'kalgo':                 { name: 'Kalgo', fee: 3600 },
            'koko-besse':            { name: 'Koko/Besse', fee: 3600 },
            'maiyama':               { name: 'Maiyama', fee: 3600 },
            'ngaski':                { name: 'Ngaski', fee: 3700 },
            'sakaba':                { name: 'Sakaba', fee: 3700 },
            'shanga':                { name: 'Shanga', fee: 3600 },
            'surU':                  { name: 'Suru', fee: 3600 },
            'wasagu-danko':          { name: 'Wasagu/Danko', fee: 3700 },
            'yauri':                 { name: 'Yauri', fee: 3700 },
            'zuru':                  { name: 'Zuru', fee: 3700 }
        }
    },

    'sokoto': {
        name: 'Sokoto',
        lgas: {
            'binji':                 { name: 'Binji', fee: 3600 },
            'bodinga':               { name: 'Bodinga', fee: 3500 },
            'dange-shuni':           { name: 'Dange Shuni', fee: 3600 },
            'gada':                  { name: 'Gada', fee: 3700 },
            'goronyo':               { name: 'Goronyo', fee: 3700 },
            'gudu':                  { name: 'Gudu', fee: 3600 },
            'gwadabawa':             { name: 'Gwadabawa', fee: 3600 },
            'ilawa':                 { name: 'Ilawa', fee: 3600 },
            'isa':                   { name: 'Isa', fee: 3700 },
            'kebbe':                 { name: 'Kebbe', fee: 3600 },
            'kware':                 { name: 'Kware', fee: 3500 },
            'rabah':                 { name: 'Rabah', fee: 3600 },
            'sabon-birni':           { name: 'Sabon Birni', fee: 3700 },
            'shagari':               { name: 'Shagari', fee: 3600 },
            'silame':                { name: 'Silame', fee: 3600 },
            'sokoto-north':          { name: 'Sokoto North', fee: 3400 },
            'sokoto-south':          { name: 'Sokoto South', fee: 3400 },
            'tambuwal':              { name: 'Tambuwal', fee: 3600 },
            'tangaza':               { name: 'Tangaza', fee: 3600 },
            'tureta':                { name: 'Tureta', fee: 3600 },
            'wamako':                { name: 'Wamako', fee: 3500 },
            'wurno':                 { name: 'Wurno', fee: 3600 },
            'yabo':                  { name: 'Yabo', fee: 3600 }
        }
    },

    'zamfara': {
        name: 'Zamfara',
        lgas: {
            'anjam':                 { name: 'Anjam', fee: 3700 },
            'bakura':                { name: 'Bakura', fee: 3700 },
            'birnin-magaji':         { name: 'Birnin Magaji', fee: 3700 },
            'bukkuyum':              { name: 'Bukkuyum', fee: 3700 },
            'bungudu':               { name: 'Bungudu', fee: 3600 },
            'gummi':                 { name: 'Gummi', fee: 3700 },
            'gusau':                 { name: 'Gusau', fee: 3500 },
            'kaura-namoda':          { name: 'Kaura Namoda', fee: 3700 },
            'maradun':               { name: 'Maradun', fee: 3700 },
            'maru':                  { name: 'Maru', fee: 3700 },
            'shinkafi':              { name: 'Shinkafi', fee: 3700 },
            'talata-mafara':         { name: 'Talata Mafara', fee: 3700 },
            'tsafe':                 { name: 'Tsafe', fee: 3600 },
            'zurmi':                 { name: 'Zurmi', fee: 3700 }
        }
    },

    'jigawa': {
        name: 'Jigawa',
        lgas: {
            'auyo':                  { name: 'Auyo', fee: 3600 },
            'babura':                { name: 'Babura', fee: 3600 },
            'biriniwa':              { name: 'Biriniwa', fee: 3700 },
            'birnin-kudu':           { name: 'Birnin Kudu', fee: 3600 },
            'buji':                  { name: 'Buji', fee: 3600 },
            'dutse':                 { name: 'Dutse', fee: 3400 },
            'gagarawa':              { name: 'Gagarawa', fee: 3600 },
            'garki':                 { name: 'Garki', fee: 3600 },
            'gumel':                 { name: 'Gumel', fee: 3600 },
            'guri':                  { name: 'Guri', fee: 3700 },
            'gwaram':                { name: 'Gwaram', fee: 3600 },
            'gwiwa':                 { name: 'Gwiwa', fee: 3600 },
            'hadejia':               { name: 'Hadejia', fee: 3500 },
            'jahun':                 { name: 'Jahun', fee: 3600 },
            'kafin-hausa':           { name: 'Kafin Hausa', fee: 3600 },
            'kaugama':               { name: 'Kaugama', fee: 3600 },
            'kazaure':               { name: 'Kazaure', fee: 3600 },
            'kiri-kasamma':          { name: 'Kiri Kasamma', fee: 3700 },
            'kiyawa':                { name: 'Kiyawa', fee: 3600 },
            'maigatari':             { name: 'Maigatari', fee: 3700 },
            'malam-madori':          { name: 'Malam Madori', fee: 3600 },
            'miga':                  { name: 'Miga', fee: 3600 },
            'ringim':                { name: 'Ringim', fee: 3600 },
            'roni':                  { name: 'Roni', fee: 3600 },
            'sule-tankarkar':        { name: 'Sule Tankarkar', fee: 3700 },
            'taura':                 { name: 'Taura', fee: 3600 },
            'yankwashi':             { name: 'Yankwashi', fee: 3700 }
        }
    },

    // ============================================
    // NORTH-EAST
    // ============================================
    'borno': {
        name: 'Borno',
        lgas: {
            'abadam':                { name: 'Abadam', fee: 4000 },
            'askira-uba':            { name: 'Askira/Uba', fee: 3800 },
            'bama':                  { name: 'Bama', fee: 3800 },
            'bayO':                  { name: 'Bayo', fee: 3800 },
            'biu':                   { name: 'Biu', fee: 3800 },
            'chibok':                { name: 'Chibok', fee: 3800 },
            'damboa':                { name: 'Damboa', fee: 3800 },
            'dikwa':                 { name: 'Dikwa', fee: 3900 },
            'gubio':                 { name: 'Gubio', fee: 3900 },
            'guzamala':              { name: 'Guzamala', fee: 4000 },
            'gwoza':                 { name: 'Gwoza', fee: 3900 },
            'hawul':                 { name: 'Hawul', fee: 3800 },
            'jere':                  { name: 'Jere', fee: 3500 },
            'kaga':                  { name: 'Kaga', fee: 3800 },
            'kala-balge':            { name: 'Kala/Balge', fee: 4000 },
            'konduga':               { name: 'Konduga', fee: 3700 },
            'kukawa':                { name: 'Kukawa', fee: 4000 },
            'kwaya-kusar':           { name: 'Kwaya Kusar', fee: 3800 },
            'maiduguri':             { name: 'Maiduguri', fee: 3400 },
            'marte':                 { name: 'Marte', fee: 3900 },
            'magumeri':              { name: 'Magumeri', fee: 3800 },
            'mobbar':                { name: 'Mobbar', fee: 3900 },
            'monguno':               { name: 'Monguno', fee: 3900 },
            'ngala':                 { name: 'Ngala', fee: 4000 },
            'nganzai':               { name: 'Nganzai', fee: 3900 },
            'shani':                 { name: 'Shani', fee: 3800 }
        }
    },

    'yobe': {
        name: 'Yobe',
        lgas: {
            'bade':                  { name: 'Bade', fee: 3900 },
            'bursari':               { name: 'Bursari', fee: 3900 },
            'damaturu':              { name: 'Damaturu', fee: 3600 },
            'fika':                  { name: 'Fika', fee: 3900 },
            'fune':                  { name: 'Fune', fee: 3900 },
            'geidam':                { name: 'Geidam', fee: 4000 },
            'gujba':                 { name: 'Gujba', fee: 3900 },
            'gulani':                { name: 'Gulani', fee: 3900 },
            'jakusko':               { name: 'Jakusko', fee: 3900 },
            'karasuwa':              { name: 'Karasuwa', fee: 3900 },
            'machina':               { name: 'Machina', fee: 4000 },
            'nangere':               { name: 'Nangere', fee: 3900 },
            'nguru':                 { name: 'Nguru', fee: 3900 },
            'potiskum':              { name: 'Potiskum', fee: 3700 },
            'tarmuwa':               { name: 'Tarmuwa', fee: 3900 },
            'yunusari':              { name: 'Yunusari', fee: 4000 },
            'yusufari':              { name: 'Yusufari', fee: 4000 }
        }
    },

    'bauchi': {
        name: 'Bauchi',
        lgas: {
            'alkaleri':              { name: 'Alkaleri', fee: 3700 },
            'bauchi':                { name: 'Bauchi', fee: 3500 },
            'bogoro':                { name: 'Bogoro', fee: 3700 },
            'damban':                { name: 'Damban', fee: 3700 },
            'darazo':                { name: 'Darazo', fee: 3700 },
            'dass':                  { name: 'Dass', fee: 3700 },
            'gamawa':                { name: 'Gamawa', fee: 3800 },
            'ganjuwa':               { name: 'Ganjuwa', fee: 3700 },
            'giade':                 { name: 'Giade', fee: 3700 },
            'itas-gadau':            { name: 'Itas/Gadau', fee: 3700 },
            'jama-are':              { name: 'Jama\'are', fee: 3800 },
            'katagum':               { name: 'Katagum', fee: 3800 },
            'kirfi':                 { name: 'Kirfi', fee: 3700 },
            'misau':                 { name: 'Misau', fee: 3700 },
            'ningi':                 { name: 'Ningi', fee: 3700 },
            'shira':                 { name: 'Shira', fee: 3800 },
            'tafawa-balewa':         { name: 'Tafawa Balewa', fee: 3700 },
            'toro':                  { name: 'Toro', fee: 3700 },
            'warji':                 { name: 'Warji', fee: 3800 },
            'zaki':                  { name: 'Zaki', fee: 3800 }
        }
    },

    'gombe': {
        name: 'Gombe',
        lgas: {
            'akko':                  { name: 'Akko', fee: 3700 },
            'balanga':               { name: 'Balanga', fee: 3800 },
            'billiri':               { name: 'Billiri', fee: 3700 },
            'dukku':                 { name: 'Dukku', fee: 3800 },
            'funakaye':              { name: 'Funakaye', fee: 3800 },
            'gombe':                 { name: 'Gombe', fee: 3500 },
            'kaltungo':              { name: 'Kaltungo', fee: 3700 },
            'kwami':                 { name: 'Kwami', fee: 3700 },
            'nafada':                { name: 'Nafada', fee: 3800 },
            'shongom':               { name: 'Shongom', fee: 3800 },
            'yamaltu-deba':          { name: 'Yamaltu/Deba', fee: 3700 }
        }
    },

    'adamawa': {
        name: 'Adamawa',
        lgas: {
            'demsa':                 { name: 'Demsa', fee: 3900 },
            'fufore':                { name: 'Fufore', fee: 3800 },
            'ganye':                 { name: 'Ganye', fee: 3900 },
            'girei':                 { name: 'Girei', fee: 3700 },
            'gombi':                 { name: 'Gombi', fee: 3900 },
            'guyuk':                 { name: 'Guyuk', fee: 3900 },
            'hong':                  { name: 'Hong', fee: 3900 },
            'jada':                  { name: 'Jada', fee: 3900 },
            'lamurde':               { name: 'Lamurde', fee: 3900 },
            'madagali':              { name: 'Madagali', fee: 4000 },
            'maiha':                 { name: 'Maiha', fee: 4000 },
            'mayo-belwa':            { name: 'Mayo Belwa', fee: 3900 },
            'michika':               { name: 'Michika', fee: 4000 },
            'mubi-north':            { name: 'Mubi North', fee: 3900 },
            'mubi-south':            { name: 'Mubi South', fee: 3900 },
            'numan':                 { name: 'Numan', fee: 3800 },
            'shelleng':              { name: 'Shelleng', fee: 3900 },
            'song':                  { name: 'Song', fee: 3900 },
            'toungo':                { name: 'Toungo', fee: 4000 },
            'yola-north':            { name: 'Yola North', fee: 3600 },
            'yola-south':            { name: 'Yola South', fee: 3600 }
        }
    },

    'taraba': {
        name: 'Taraba',
        lgas: {
            'ardo-kola':             { name: 'Ardo Kola', fee: 4000 },
            'bali':                  { name: 'Bali', fee: 4000 },
            'donga':                 { name: 'Donga', fee: 4000 },
            'gashaka':               { name: 'Gashaka', fee: 4100 },
            'gassol':                { name: 'Gassol', fee: 4000 },
            'ibi':                   { name: 'Ibi', fee: 3900 },
            'jalingo':               { name: 'Jalingo', fee: 3700 },
            'karim-lamido':          { name: 'Karim Lamido', fee: 4000 },
            'kurmi':                 { name: 'Kurmi', fee: 4100 },
            'lau':                   { name: 'Lau', fee: 4000 },
            'sardauna':              { name: 'Sardauna', fee: 4100 },
            'takum':                 { name: 'Takum', fee: 4000 },
            'ussa':                  { name: 'Ussa', fee: 4000 },
            'wukari':                { name: 'Wukari', fee: 3900 },
            'yorro':                 { name: 'Yorro', fee: 4000 },
            'zing':                  { name: 'Zing', fee: 4000 }
        }
    }
};

// Fallback fee for any state/LGA not specified above
const FALLBACK_SHIPPING_FEE = 3500;

// ============================================
// PUBLIC FUNCTIONS
// ============================================

// Get a sorted list of all states for the dropdown
function getAllStates() {
    return Object.entries(NIGERIA_SHIPPING_DATA)
        .map(([slug, data]) => ({ slug, name: data.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// Get the LGAs for a specific state, sorted alphabetically
function getLGAsForState(stateSlug) {
    const stateData = NIGERIA_SHIPPING_DATA[stateSlug];
    if (!stateData) return [];
    return Object.entries(stateData.lgas)
        .map(([slug, lga]) => ({ slug, ...lga }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// Get the shipping fee based on the selected state and LGA
function getShippingFee(stateSlug, lgaSlug) {
    if (!stateSlug) return FALLBACK_SHIPPING_FEE;
    const stateData = NIGERIA_SHIPPING_DATA[stateSlug];
    if (!stateData) return FALLBACK_SHIPPING_FEE;
    if (!lgaSlug) return FALLBACK_SHIPPING_FEE;
    const lgaData = stateData.lgas[lgaSlug];
    if (!lgaData) return FALLBACK_SHIPPING_FEE;
    return lgaData.fee;
}