from app.matching import free_gaps, free_windows, intersect, total_minutes


def test_gaps_only_between_classes():

    meetings = [(540, 590), (660, 740), (840, 920)]
    assert free_gaps(meetings, 30) == [(590, 660), (740, 840)]


def test_short_gaps_ignored():
    assert free_gaps([(540, 590), (600, 650)], 30) == []


def test_overlapping_mettings_merge():
    assert free_gaps([(540, 700), (600, 650), (760, 800)], 30) == [(700, 760)]


def test_one_class_means_no_gaps():
    assert free_gaps([(540, 590)], 30) == []


def test_intersect():
    a = [(590, 660), (740, 840)]
    b = [(600, 800)]

    assert intersect(a, b, 30) == [(600, 660), (740, 800)]
    assert total_minutes(intersect(a, b, 30)) == 120


def test_intersect_respects_minimum():
    assert intersect([(600, 620)], [(600, 700)], 30) == []


def test_free_windows_without_hours_matches_free_gaps():
    classes = [(540, 600), (840, 900)]
    assert free_windows(classes, None, 30) == free_gaps(classes, 30)


def test_free_windows_inside_campus():
    assert free_windows([(540, 600), (840, 900)], (480, 1020), 30) == [
        (480, 540),
        (600, 840),
        (900, 1020),
    ]


def test_free_windows_no_classes():
    assert free_windows([], (600, 720), 30) == [(600, 720)]


def test_free_windows_ignores_classes_outside_hours():
    assert free_windows([(420, 470), (1100, 1150)], (480, 600), 30) == [(480, 600)]


def test_free_windows_drops_short_pieces():
    assert free_windows([(500, 600)], (480, 700), 30) == [(600, 700)]


def test_free_windows_class_touching_edges():
    assert free_windows([(480, 540), (660, 720)], (480, 720), 30) == [(540, 660)]
