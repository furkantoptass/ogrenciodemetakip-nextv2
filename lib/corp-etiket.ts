// Kurumsal etiket numaraları. Ekran parçaları buradan okur; veri dosyasına bağlanmaz.
const ENV_CORP_LABEL_IDS = process.env.NEXT_PUBLIC_ODT_DEFAULT_CORP_LABEL_IDS;

export const ODT_DEFAULT_CORP_LABEL_IDS =
  ENV_CORP_LABEL_IDS !== undefined
    ? ENV_CORP_LABEL_IDS.split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0)
    : [663, 1079, 1082, 1085, 875, 1077, 1080, 1083, 779, 1078, 1081, 1084, 1090];

export const ODT_DEFAULT_ACTIVE_CORP_IDS = ODT_DEFAULT_CORP_LABEL_IDS.filter((id) => id !== 875 && id !== 1090);
