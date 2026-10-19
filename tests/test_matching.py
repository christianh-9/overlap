from app.matching import free_gaps, intersect, total_minutes


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
