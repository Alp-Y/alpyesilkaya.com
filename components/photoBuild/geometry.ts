/**
 * Outlines traced from the About photo, in the photo's own pixels. They are
 * what the drafter's cursor draws when it "builds" the picture
 * (components/photoBuild/PhotoBuild.tsx). A new photo needs new outlines:
 * without them the photo simply appears with the usual wipe.
 */
export type PhotoGeometry = {
  /** The photo's size in pixels: the outlines are in these units. */
  width: number;
  height: number;
  /** Closed outline of the figure, "x,y x,y …", starting at the top of the head. */
  person: string;
  /** The skyline (ridge), left edge to right edge, "x,y x,y …". */
  ridge: string;
};

export const PHOTO_GEOMETRY: Record<string, PhotoGeometry> = {
  // public/images/about-mountain.jpg
  mountain: {
    width: 1400,
    height: 2100,
    person:
      "733,1101 711,1114 710,1121 697,1132 696,1149 683,1163 682,1180 689,1188 706,1192 706,1206 670,1218 673,1252 661,1270 654,1297 646,1370 631,1436 630,1498 647,1499 661,1552 662,1633 674,1646 677,1686 688,1695 688,1746 705,1817 716,1834 716,1850 693,1884 657,1905 619,1909 619,1915 625,1918 675,1916 678,1910 717,1909 727,1916 739,1916 742,1902 778,1901 779,1913 788,1913 792,1918 817,1918 829,1909 828,1869 815,1865 815,1850 823,1839 823,1807 831,1805 830,1789 813,1741 799,1647 788,1643 785,1604 793,1601 803,1534 817,1511 826,1450 822,1406 837,1326 835,1251 844,1245 844,1239 816,1224 809,1215 809,1201 823,1193 825,1181 823,1164 812,1157 801,1147 799,1135 793,1122 783,1111 770,1104 752,1100",
    ridge:
      "0,1004 16,1003 48,993 96,966 320,814 504,703 608,623 640,607 688,569 704,564 744,573 808,614 880,651 904,671 944,720 968,740 1008,752 1080,782 1160,806 1184,820 1232,858 1288,886 1336,925 1360,932 1392,934 1400,934",
  },
};
